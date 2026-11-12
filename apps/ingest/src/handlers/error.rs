use axum::{Json, extract::State, http::HeaderMap};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    db::validate_api_key,
    errors::AppResult,
    models::{OkResponse, TrackErrorPayload},
};

pub async fn track_error(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Json(payload): Json<TrackErrorPayload>,
) -> AppResult<Json<OkResponse>> {
    let api_key = crate::handlers::track::extract_api_key_pub(&headers)?;
    validate_api_key(&pool, &api_key, &payload.project_id).await?;

    let ip = crate::handlers::track::extract_ip_pub(&headers);
    let breadcrumbs_str = payload.breadcrumbs.to_string();

    // Fingerprint = lightweight hash of "message|first-stack-line"
    let stack_first = payload
        .stack
        .as_deref()
        .and_then(|s| s.lines().next())
        .unwrap_or("");
    let fp_raw = format!("{}|{}", payload.message, stack_first);
    let fingerprint = format!("{:016x}", fxhash64(&fp_raw));

    // ── Upsert ErrorGroup ──────────────────────────────────────────────────────
    let existing_group_id: Option<String> = sqlx::query_scalar(
        r#"SELECT id FROM error_group WHERE "projectId" = $1 AND fingerprint = $2 LIMIT 1"#,
    )
    .bind(&payload.project_id)
    .bind(&fingerprint)
    .fetch_optional(&pool)
    .await?;

    let group_id = if let Some(gid) = existing_group_id {
        sqlx::query(
            r#"UPDATE error_group
               SET occurrences = occurrences + 1, "lastSeenAt" = NOW()
               WHERE id = $1"#,
        )
        .bind(&gid)
        .execute(&pool)
        .await?;
        gid
    } else {
        let gid = Uuid::new_v4().to_string();
        let error_type = payload.r#type.as_deref().unwrap_or("error");
        sqlx::query(
            r#"INSERT INTO error_group
               (id, fingerprint, message, type, status, occurrences,
                "firstSeenAt", "lastSeenAt", "projectId")
               VALUES ($1, $2, $3, $4, 'unresolved', 1, NOW(), NOW(), $5)"#,
        )
        .bind(&gid)
        .bind(&fingerprint)
        .bind(&payload.message)
        .bind(error_type)
        .bind(&payload.project_id)
        .execute(&pool)
        .await?;
        gid
    };

    // ── Find latest session recording for this visitor ─────────────────────────
    let recording_id: Option<String> = if let Some(vid) = &payload.visitor_id {
        sqlx::query_scalar(
            r#"SELECT id FROM session_recording
               WHERE "visitorId" = $1 AND "projectId" = $2
               ORDER BY "createdAt" DESC LIMIT 1"#,
        )
        .bind(vid)
        .bind(&payload.project_id)
        .fetch_optional(&pool)
        .await
        .unwrap_or(None)
    } else {
        None
    };

    // Bump errorCount on recording (non-fatal)
    if let Some(rid) = &recording_id {
        let _ = sqlx::query(
            r#"UPDATE session_recording SET "errorCount" = "errorCount" + 1 WHERE id = $1"#,
        )
        .bind(rid)
        .execute(&pool)
        .await;
    }

    // ── Insert ErrorEvent ──────────────────────────────────────────────────────
    let event_id = Uuid::new_v4().to_string();
    let ua = payload.user_agent.as_deref().unwrap_or("");
    sqlx::query(
        r#"INSERT INTO error_event
           (id, message, stack, url, line, col,
            "userAgent", "ipAddress", "visitorId", breadcrumbs,
            "createdAt", "groupId", "projectId", "recordingId")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13)"#,
    )
    .bind(&event_id)
    .bind(&payload.message)
    .bind(&payload.stack)
    .bind(&payload.url)
    .bind(payload.line)
    .bind(payload.col)
    .bind(ua)
    .bind(&ip)
    .bind(&payload.visitor_id)
    .bind(&breadcrumbs_str)
    .bind(&group_id)
    .bind(&payload.project_id)
    .bind(&recording_id)
    .execute(&pool)
    .await?;

    tracing::warn!(
        project     = %payload.project_id,
        fingerprint = %fingerprint,
        msg         = %payload.message,
        group       = %group_id,
        "error captured"
    );

    Ok(Json(OkResponse { ok: true, id: event_id }))
}

// ── Fast non-crypto fingerprint hash ──────────────────────────────────────────
fn fxhash64(s: &str) -> u64 {
    const K: u64 = 0x517cc1b727220a95;
    let mut h: u64 = 0;
    for b in s.bytes() {
        h = h.rotate_left(5).wrapping_add(h) ^ (b as u64);
        h = h.wrapping_mul(K);
    }
    h
}
