use axum::{extract::State, http::HeaderMap, Json};
use uuid::Uuid;

use crate::{
    db::validate_api_key,
    errors::{AppError, AppResult},
    models::{OkResponse, SessionFramesPayload, SessionStartPayload},
    AppState,
};

// ─── POST /session/start ──────────────────────────────────────────────────────

pub async fn session_start(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<SessionStartPayload>,
) -> AppResult<Json<OkResponse>> {
    let api_key = crate::handlers::track::extract_api_key(&headers)?;
    let mut conn = state.conn().await.map_err(AppError::Sqlx)?;
    validate_api_key(&mut conn, &state.key_cache, &api_key, &payload.project_id).await?;

    let ua = payload.user_agent.as_deref().unwrap_or("");
    let ip = crate::handlers::track::extract_ip(&headers);

    let existing: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM session_recording
           WHERE "visitorId" = $1 AND "projectId" = $2
           ORDER BY "createdAt" DESC LIMIT 1"#,
    )
    .bind(&payload.visitor_id)
    .bind(&payload.project_id)
    .fetch_optional(&mut conn)
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
               VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,0,0,0,NOW(),NOW(),$8)"#,
        )
        .bind(&new_id)
        .bind(&payload.visitor_id)
        .bind(&payload.start_url)
        .bind(ua)
        .bind(&ip)
        .bind(payload.viewport_w)
        .bind(payload.viewport_h)
        .bind(&payload.project_id)
        .execute(&mut conn)
        .await?;
        new_id
    };

    tracing::info!(visitor = %payload.visitor_id, recording = %id, "session started");
    Ok(Json(OkResponse { ok: true, id }))
}

// ─── POST /session/frames ─────────────────────────────────────────────────────

pub async fn session_frames(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<SessionFramesPayload>,
) -> AppResult<Json<OkResponse>> {
    let api_key = crate::handlers::track::extract_api_key(&headers)?;
    let mut conn = state.conn().await.map_err(AppError::Sqlx)?;
    validate_api_key(&mut conn, &state.key_cache, &api_key, &payload.project_id).await?;

    let frames_str = payload.frames.to_string();
    let frames_count: i32 = match &payload.frames {
        serde_json::Value::Array(a) => a.len() as i32,
        _ => 0,
    };

    // Find or lazily create the recording
    let existing: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM session_recording
           WHERE "visitorId" = $1 AND "projectId" = $2
           ORDER BY "createdAt" DESC LIMIT 1"#,
    )
    .bind(&payload.visitor_id)
    .bind(&payload.project_id)
    .fetch_optional(&mut conn)
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
               VALUES ($1,$2,'','',NULL,$3,0,0,0,0,NOW(),NOW(),$4)"#,
        )
        .bind(&new_id)
        .bind(&payload.visitor_id)
        .bind(payload.duration)
        .bind(&payload.project_id)
        .execute(&mut conn)
        .await?;
        new_id
    };

    // BEGIN transaction for sequence number + chunk insert (advisory lock)
    sqlx::query("BEGIN").execute(&mut conn).await?;

    sqlx::query("SELECT id FROM session_recording WHERE id = $1 FOR UPDATE")
        .bind(&recording_id)
        .fetch_one(&mut conn)
        .await?;

    let next_seq: i32 = sqlx::query_scalar(
        r#"SELECT COALESCE(MAX(sequence), -1) + 1
           FROM session_recording_chunk WHERE "recordingId" = $1"#,
    )
    .bind(&recording_id)
    .fetch_one(&mut conn)
    .await?;

    let chunk_id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO session_recording_chunk
           (id, "recordingId", sequence, "framesCount", frames, "createdAt")
           VALUES ($1,$2,$3,$4,$5,NOW())"#,
    )
    .bind(&chunk_id)
    .bind(&recording_id)
    .bind(next_seq)
    .bind(frames_count)
    .bind(&frames_str)
    .execute(&mut conn)
    .await?;

    sqlx::query(
        r#"UPDATE session_recording
           SET duration    = $1,
               "exitUrl"   = COALESCE(NULLIF($2,''), "exitUrl"),
               "updatedAt" = NOW()
           WHERE id = $3"#,
    )
    .bind(payload.duration)
    .bind(payload.exit_url.as_deref().unwrap_or(""))
    .bind(&recording_id)
    .execute(&mut conn)
    .await?;

    sqlx::query("COMMIT").execute(&mut conn).await?;

    tracing::debug!(
        visitor   = %payload.visitor_id,
        recording = %recording_id,
        chunk     = next_seq,
        frames    = frames_count,
        "frames flushed"
    );
    Ok(Json(OkResponse {
        ok: true,
        id: chunk_id,
    }))
}
