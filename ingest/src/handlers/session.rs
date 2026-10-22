use axum::{Json, extract::State, http::HeaderMap};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    db::validate_api_key,
    errors::AppResult,
    models::{OkResponse, SessionFramesPayload, SessionStartPayload},
};

// ─── POST /session/start ──────────────────────────────────────────────────────
/// Creates a session_recording row (idempotent — keyed on visitorId+projectId).

pub async fn session_start(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Json(payload): Json<SessionStartPayload>,
) -> AppResult<Json<OkResponse>> {
    let api_key = crate::handlers::track::extract_api_key_pub(&headers)?;
    validate_api_key(&pool, &api_key, &payload.project_id).await?;

    let ua = payload.user_agent.as_deref().unwrap_or("");
    let ip = crate::handlers::track::extract_ip_pub(&headers);
    let viewport_w = payload.viewport_w;
    let viewport_h = payload.viewport_h;

    // Upsert: reuse existing recording if one already exists for this visitorId+project
    let existing_id = sqlx::query_scalar!(
        "SELECT id FROM session_recording WHERE visitorId = ? AND projectId = ? LIMIT 1",
        payload.visitor_id,
        payload.project_id,
    )
    .fetch_optional(&pool)
    .await?;

    let id = if let Some(eid) = existing_id {
        eid
    } else {
        let new_id = Uuid::new_v4().to_string();
        sqlx::query!(
            r#"INSERT INTO session_recording
               (id, visitorId, startUrl, userAgent, ipAddress,
                viewportW, viewportH, duration, clickCount, rageClickCount,
                deadClickCount, errorCount, createdAt, updatedAt, projectId)
               VALUES
               (?, ?, ?, ?, ?,
                ?, ?, 0, 0, 0,
                0, 0, datetime('now'), datetime('now'), ?)"#,
            new_id,
            payload.visitor_id,
            payload.start_url,
            ua,
            ip,
            viewport_w,
            viewport_h,
            payload.project_id,
        )
        .execute(&pool)
        .await?;
        new_id
    };

    tracing::info!(visitor = %payload.visitor_id, recording = %id, "session started");
    Ok(Json(OkResponse { ok: true, id }))
}

// ─── POST /session/frames ─────────────────────────────────────────────────────
/// Appends a batch of rrweb-compatible frames to the recording as a new Chunk.
/// Uses an append-only SessionRecordingChunk row — never rewrites existing data.

pub async fn session_frames(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Json(payload): Json<SessionFramesPayload>,
) -> AppResult<Json<OkResponse>> {
    let api_key = crate::handlers::track::extract_api_key_pub(&headers)?;
    validate_api_key(&pool, &api_key, &payload.project_id).await?;

    let frames_str = payload.frames.to_string();
    let frames_count = match &payload.frames {
        serde_json::Value::Array(a) => a.len() as i64,
        _ => 0,
    };

    // Resolve (or lazily create) the session recording
    let recording_id = {
        let existing = sqlx::query_scalar!(
            "SELECT id FROM session_recording WHERE visitorId = ? AND projectId = ? LIMIT 1",
            payload.visitor_id,
            payload.project_id,
        )
        .fetch_optional(&pool)
        .await?;

        if let Some(eid) = existing {
            eid
        } else {
            // Frames arrived before /session/start — create recording on the fly
            let new_id = Uuid::new_v4().to_string();
            sqlx::query!(
                r#"INSERT INTO session_recording
                   (id, visitorId, startUrl, userAgent, ipAddress,
                    duration, clickCount, rageClickCount, deadClickCount,
                    errorCount, createdAt, updatedAt, projectId)
                   VALUES
                   (?, ?, '', '', NULL,
                    ?, 0, 0, 0,
                    0, datetime('now'), datetime('now'), ?)"#,
                new_id,
                payload.visitor_id,
                payload.duration,
                payload.project_id,
            )
            .execute(&pool)
            .await?;
            new_id
        }
    };

    // Determine the next sequence number for this recording
    let next_seq: i64 = sqlx::query_scalar!(
        "SELECT COALESCE(MAX(sequence), -1) + 1 FROM session_recording_chunk WHERE recordingId = ?",
        recording_id,
    )
    .fetch_one(&pool)
    .await
    .unwrap_or(0);

    let chunk_id = Uuid::new_v4().to_string();
    sqlx::query!(
        r#"INSERT INTO session_recording_chunk
           (id, recordingId, sequence, framesCount, frames, createdAt)
           VALUES (?, ?, ?, ?, ?, datetime('now'))"#,
        chunk_id,
        recording_id,
        next_seq,
        frames_count,
        frames_str,
    )
    .execute(&pool)
    .await?;

    // Update duration + exitUrl on the parent recording
    let dur = payload.duration;
    let exit_url = payload.exit_url.as_deref().unwrap_or("");
    sqlx::query!(
        "UPDATE session_recording SET duration = ?, exitUrl = CASE WHEN ? != '' THEN ? ELSE exitUrl END, updatedAt = datetime('now') WHERE id = ?",
        dur,
        exit_url,
        exit_url,
        recording_id,
    )
    .execute(&pool)
    .await?;

    tracing::debug!(
        visitor = %payload.visitor_id,
        recording = %recording_id,
        chunk = next_seq,
        frames = frames_count,
        "frames flushed"
    );
    Ok(Json(OkResponse { ok: true, id: chunk_id }))
}
