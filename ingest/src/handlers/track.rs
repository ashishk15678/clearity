use axum::{Json, extract::State, http::HeaderMap};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    db::validate_api_key,
    errors::AppResult,
    models::{OkResponse, TrackEventPayload, TrackPageViewPayload},
};

// ─── POST /track/event ────────────────────────────────────────────────────────

pub async fn track_event(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Json(payload): Json<TrackEventPayload>,
) -> AppResult<Json<OkResponse>> {
    let api_key = extract_api_key(&headers)?;
    validate_api_key(&pool, &api_key, &payload.project_id).await?;

    let id = Uuid::new_v4().to_string();
    let properties = payload.properties.to_string();
    let ip = extract_ip(&headers);
    let ua = extract_ua(&headers);

    // Derive path from url for page events
    let url = payload.url.as_deref().unwrap_or("");

    sqlx::query!(
        r#"
        INSERT INTO event
            (id, type, name, properties, url, selector, x, y,
             visitorId, userId, createdAt, projectId, recordingId)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?,
             ?, ?, datetime('now'), ?, ?)
        "#,
        id,
        payload.r#type,
        payload.name,
        properties,
        url,
        payload.selector,
        payload.x,
        payload.y,
        payload.visitor_id,
        payload.user_id,
        payload.project_id,
        payload.recording_id,
    )
    .execute(&pool)
    .await?;

    // If this is a rage-click/dead-click, increment the counter on the recording
    if let Some(rid) = &payload.recording_id {
        match payload.r#type.as_str() {
            "rage_click" => {
                let _ = sqlx::query!(
                    "UPDATE session_recording SET rageClickCount = rageClickCount + 1, clickCount = clickCount + 1 WHERE id = ?",
                    rid
                ).execute(&pool).await;
            }
            "dead_click" => {
                let _ = sqlx::query!(
                    "UPDATE session_recording SET deadClickCount = deadClickCount + 1, clickCount = clickCount + 1 WHERE id = ?",
                    rid
                ).execute(&pool).await;
            }
            "click" => {
                let _ = sqlx::query!(
                    "UPDATE session_recording SET clickCount = clickCount + 1 WHERE id = ?",
                    rid
                ).execute(&pool).await;
            }
            _ => {}
        }
    }

    tracing::info!(project = %payload.project_id, name = %payload.name, r#type = %payload.r#type, "event tracked");
    Ok(Json(OkResponse { ok: true, id }))
}

// ─── POST /track/pageview ─────────────────────────────────────────────────────

pub async fn track_pageview(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Json(payload): Json<TrackPageViewPayload>,
) -> AppResult<Json<OkResponse>> {
    let api_key = extract_api_key(&headers)?;
    validate_api_key(&pool, &api_key, &payload.project_id).await?;

    let id = Uuid::new_v4().to_string();

    // Derive path: strip query string and fragment
    let path = derive_path(&payload.url);

    sqlx::query!(
        r#"
        INSERT INTO page_view
            (id, url, path, referrer, visitorId, userId,
             duration, maxScrollY, createdAt, projectId, recordingId)
        VALUES
            (?, ?, ?, ?, ?, ?,
             ?, ?, datetime('now'), ?, ?)
        "#,
        id,
        payload.url,
        path,
        payload.referrer,
        payload.visitor_id,
        payload.user_id,
        payload.duration,
        payload.max_scroll_y,
        payload.project_id,
        payload.recording_id,
    )
    .execute(&pool)
    .await?;

    tracing::info!(project = %payload.project_id, url = %payload.url, "pageview tracked");
    Ok(Json(OkResponse { ok: true, id }))
}

// ─── Helpers (pub so session.rs / error.rs can reuse) ────────────────────────

pub fn extract_api_key_pub(headers: &HeaderMap) -> AppResult<String> {
    extract_api_key(headers)
}

pub fn extract_ip_pub(headers: &HeaderMap) -> Option<String> {
    extract_ip(headers)
}

pub fn extract_ua_pub(headers: &HeaderMap) -> Option<String> {
    extract_ua(headers)
}

fn extract_api_key(headers: &HeaderMap) -> AppResult<String> {
    if let Some(val) = headers.get("x-api-key") {
        return val.to_str().map(String::from)
            .map_err(|_| crate::errors::AppError::Unauthorized("Invalid X-API-Key header".into()));
    }
    if let Some(val) = headers.get("authorization") {
        let raw = val.to_str()
            .map_err(|_| crate::errors::AppError::Unauthorized("Invalid Authorization header".into()))?;
        if let Some(token) = raw.strip_prefix("Bearer ") {
            return Ok(token.to_string());
        }
    }
    Err(crate::errors::AppError::Unauthorized(
        "Missing API key — provide X-API-Key header or Authorization: Bearer <key>".into(),
    ))
}

fn extract_ip(headers: &HeaderMap) -> Option<String> {
    headers.get("x-forwarded-for")
        .or_else(|| headers.get("x-real-ip"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string())
}

fn extract_ua(headers: &HeaderMap) -> Option<String> {
    headers.get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(String::from)
}

fn derive_path(url: &str) -> String {
    // Strip scheme + host, keep only path
    let without_scheme = url
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    let path_start = without_scheme.find('/').map(|i| i).unwrap_or(without_scheme.len());
    let full_path = &without_scheme[path_start..];
    // Strip query string and fragment
    let path = full_path
        .split('?').next()
        .and_then(|p| p.split('#').next())
        .unwrap_or(full_path);
    if path.is_empty() { "/".to_string() } else { path.to_string() }
}
