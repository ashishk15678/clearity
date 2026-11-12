use axum::{Json, extract::State, http::HeaderMap};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    db::validate_api_key,
    errors::AppResult,
    models::{OkResponse, SessionFramesPayload, SessionStartPayload},
};

// ─── POST /session/start ──────────────────────────────────────────────────────

pub async fn session_start(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Json(payload): Json<SessionStartPayload>,
) -> AppResult<Json<OkResponse>> {
    let api_key = crate::handlers::track::extract_api_key_pub(&headers)?;
    validate_api_key(&pool, &api_key, &payload.project_id).await?;

    let ua = payload.user_agent.as_deref().unwrap_or("");
    let ip = crate::handlers::track::extract_ip_pub(&headers);

    // Idempotent: reuse the most-recent recording for this visitor
    let existing: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM session_recording
           WHERE "visitorId" = $1 AND "projectId" = $2
           ORDER BY "createdAt" DESC LIMIT 1"#,
    )
    .bind(&payload.visitor_id)
    .bind(&payload.project_id)
    .fetch_optional(&pool)
    .await?;

    let id = if let Some(eid) = existing {
        eid
    } else {
        let new_id = Uuid::new_v4().to_string();
        sqlx::query(
            r#"INSERT INTO session_recording
               (id, "visitorId", "startUrl", "userAgent", "ipAddress",
                "viewportW", "viewportH", duration, "clickCount", "rageClickCount",
                "deadClickCount", "errorCount", "createdAt", "updatedAt", "projectId")
               VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, 0, 0, 0, NOW(), NOW(), $8)"#,
        )
        .bind(&new_id)
        .bind(&payload.visitor_id)
        .bind(&payload.start_url)
        .bind(ua)
        .bind(&ip)
        .bind(payload.viewport_w)
        .bind(payload.viewport_h)
        .bind(&payload.project_id)
        .execute(&pool)
        .await?;
        new_id
    };

    tracing::info!(visitor = %payload.visitor_id, recording = %id, "session started");
    Ok(Json(OkResponse { ok: true, id }))
}

// ─── POST /session/frames ─────────────────────────────────────────────────────

pub async fn session_frames(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Json(payload): Json<SessionFramesPayload>,
) -> AppResult<Json<OkResponse>> {
    let api_key = crate::handlers::track::extract_api_key_pub(&headers)?;
    validate_api_key(&pool, &api_key, &payload.project_id).await?;

    let frames_str = payload.frames.to_string();
    let frames_count: i32 = match &payload.frames {
        serde_json::Value::Array(a) => a.len() as i32,
        _ => 0,
    };

    // Resolve or lazily create the recording
    let existing: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM session_recording
           WHERE "visitorId" = $1 AND "projectId" = $2
           ORDER BY "createdAt" DESC LIMIT 1"#,
    )
    .bind(&payload.visitor_id)
    .bind(&payload.project_id)
    .fetch_optional(&pool)
    .await?;

    let recording_id = if let Some(eid) = existing {
        eid
    } else {
        let new_id = Uuid::new_v4().to_string();
        sqlx::query(
            r#"INSERT INTO session_recording
               (id, "visitorId", "startUrl", "userAgent", "ipAddress",
                duration, "clickCount", "rageClickCount", "deadClickCount",
                "errorCount", "createdAt", "updatedAt", "projectId")
               VALUES ($1, $2, '', '', NULL, $3, 0, 0, 0, 0, NOW(), NOW(), $4)"#,
        )
        .bind(&new_id)
        .bind(&payload.visitor_id)
        .bind(payload.duration)
        .bind(&payload.project_id)
        .execute(&pool)
        .await?;
        new_id
    };

    // Transaction + advisory lock so concurrent flushes can't race on the sequence number
    let mut tx = pool.begin().await?;

    // Row-level lock on the parent recording row
    sqlx::query("SELECT id FROM session_recording WHERE id = $1 FOR UPDATE")
        .bind(&recording_id)
        .fetch_one(&mut *tx)
        .await?;

    // Next sequence number — sequence is INT4 in the schema, so decode as i32
    let next_seq: i32 = sqlx::query_scalar(
        r#"SELECT COALESCE(MAX(sequence), -1) + 1
           FROM session_recording_chunk WHERE "recordingId" = $1"#,
    )
    .bind(&recording_id)
    .fetch_one(&mut *tx)
    .await?;

    let chunk_id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO session_recording_chunk
           (id, "recordingId", sequence, "framesCount", frames, "createdAt")
           VALUES ($1, $2, $3, $4, $5, NOW())"#,
    )
    .bind(&chunk_id)
    .bind(&recording_id)
    .bind(next_seq)
    .bind(frames_count)
    .bind(&frames_str)
    .execute(&mut *tx)
    .await?;

    let exit_url = payload.exit_url.as_deref().unwrap_or("");
    sqlx::query(
        r#"UPDATE session_recording
           SET duration  = $1,
               "exitUrl" = COALESCE(NULLIF($2, ''), "exitUrl"),
               "updatedAt" = NOW()
           WHERE id = $3"#,
    )
    .bind(payload.duration)
    .bind(exit_url)
    .bind(&recording_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    tracing::debug!(
        visitor   = %payload.visitor_id,
        recording = %recording_id,
        chunk     = next_seq,
        frames    = frames_count,
        "frames flushed"
    );
    Ok(Json(OkResponse { ok: true, id: chunk_id }))
}
