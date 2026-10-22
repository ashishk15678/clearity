use axum::{Json, extract::State, http::HeaderMap};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    db::validate_api_key,
    errors::AppResult,
    models::{OkResponse, TrackErrorPayload},
};

// ─── POST /track/error ────────────────────────────────────────────────────────
/// Upserts into error_group (dedup by fingerprint) and inserts an error_event.

pub async fn track_error(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Json(payload): Json<TrackErrorPayload>,
) -> AppResult<Json<OkResponse>> {
    let api_key = crate::handlers::track::extract_api_key_pub(&headers)?;
    validate_api_key(&pool, &api_key, &payload.project_id).await?;

    let ip = crate::handlers::track::extract_ip_pub(&headers);
    let breadcrumbs_str = payload.breadcrumbs.to_string();

    // Fingerprint = lightweight hash of "message|first-line-of-stack"
    let stack_first = payload.stack.as_deref()
        .and_then(|s| s.lines().next())
        .unwrap_or("");
    let fp_raw = format!("{}|{}", payload.message, stack_first);
    let fingerprint = format!("{:016x}", fxhash64(&fp_raw));

    // 1. Upsert ErrorGroup ─────────────────────────────────────────────────────
    let group_id = {
        let existing = sqlx::query!(
            "SELECT id FROM error_group WHERE projectId = ? AND fingerprint = ? LIMIT 1",
            payload.project_id,
            fingerprint,
        )
        .fetch_optional(&pool)
        .await?;

        if let Some(row) = existing {
            // Bump occurrence count + lastSeenAt
            sqlx::query!(
                "UPDATE error_group SET occurrences = occurrences + 1, lastSeenAt = datetime('now') WHERE id = ?",
                row.id,
            )
            .execute(&pool)
            .await?;
            row.id
        } else {
            let gid = Uuid::new_v4().to_string();
            let error_type = payload.r#type.as_deref().unwrap_or("error");
            sqlx::query!(
                r#"INSERT INTO error_group
                   (id, fingerprint, message, type, status, occurrences,
                    firstSeenAt, lastSeenAt, projectId)
                   VALUES
                   (?, ?, ?, ?, 'unresolved', 1,
                    datetime('now'), datetime('now'), ?)"#,
                gid,
                fingerprint,
                payload.message,
                error_type,
                payload.project_id,
            )
            .execute(&pool)
            .await?;
            gid
        }
    };

    // 2. Find associated session recording (for replay linkage) ──────────────
    let recording_id: Option<String> = if let Some(vid) = &payload.visitor_id {
        sqlx::query_scalar!(
            "SELECT id FROM session_recording WHERE visitorId = ? AND projectId = ? ORDER BY createdAt DESC LIMIT 1",
            vid,
            payload.project_id,
        )
        .fetch_optional(&pool)
        .await
        .unwrap_or(None)
    } else {
        None
    };

    // 3. Bump errorCount on the recording ────────────────────────────────────
    if let Some(rid) = &recording_id {
        let _ = sqlx::query!(
            "UPDATE session_recording SET errorCount = errorCount + 1 WHERE id = ?",
            rid
        )
        .execute(&pool)
        .await;
    }

    // 4. Insert ErrorEvent (individual occurrence) ────────────────────────────
    let event_id = Uuid::new_v4().to_string();
    let ua = payload.user_agent.as_deref().unwrap_or("");
    sqlx::query!(
        r#"INSERT INTO error_event
           (id, message, stack, url, line, col,
            userAgent, ipAddress, visitorId, breadcrumbs,
            createdAt, groupId, projectId, recordingId)
           VALUES
           (?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            datetime('now'), ?, ?, ?)"#,
        event_id,
        payload.message,
        payload.stack,
        payload.url,
        payload.line,
        payload.col,
        ua,
        ip,
        payload.visitor_id,
        breadcrumbs_str,
        group_id,
        payload.project_id,
        recording_id,
    )
    .execute(&pool)
    .await?;

    tracing::warn!(
        project = %payload.project_id,
        fingerprint = %fingerprint,
        msg = %payload.message,
        group = %group_id,
        "error captured"
    );

    Ok(Json(OkResponse { ok: true, id: event_id }))
}

// ─── Fast non-crypto fingerprint hash ────────────────────────────────────────
fn fxhash64(s: &str) -> u64 {
    const K: u64 = 0x517cc1b727220a95;
    let mut h: u64 = 0;
    for b in s.bytes() {
        h = h.rotate_left(5).wrapping_add(h) ^ (b as u64);
        h = h.wrapping_mul(K);
    }
    h
}
