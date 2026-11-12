use axum::{Json, extract::State, http::HeaderMap};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    db::validate_api_key,
    errors::AppResult,
    models::{OkResponse, TrackEventPayload, TrackPageViewPayload},
};

pub async fn track_event(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Json(payload): Json<TrackEventPayload>,
) -> AppResult<Json<OkResponse>> {
    let api_key = extract_api_key(&headers)?;
    validate_api_key(&pool, &api_key, &payload.project_id).await?;

    let id = Uuid::new_v4().to_string();
    let properties = payload.properties.to_string();
    let url = payload.url.as_deref().unwrap_or("");

    sqlx::query(
        r#"INSERT INTO event
               (id, type, name, properties, url, selector, x, y,
                "visitorId", "userId", "createdAt", "projectId", "recordingId")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12)"#,
    )
    .bind(&id)
    .bind(&payload.r#type)
    .bind(&payload.name)
    .bind(&properties)
    .bind(url)
    .bind(&payload.selector)
    .bind(payload.x)
    .bind(payload.y)
    .bind(&payload.visitor_id)
    .bind(&payload.user_id)
    .bind(&payload.project_id)
    .bind(&payload.recording_id)
    .execute(&pool)
    .await?;

    // Bump click counters on the associated recording (non-fatal)
    if let Some(rid) = &payload.recording_id {
        let update_sql = match payload.r#type.as_str() {
            "rage_click" => Some(
                r#"UPDATE session_recording
                   SET "rageClickCount" = "rageClickCount" + 1,
                       "clickCount"     = "clickCount"     + 1
                   WHERE id = $1"#,
            ),
            "dead_click" => Some(
                r#"UPDATE session_recording
                   SET "deadClickCount" = "deadClickCount" + 1,
                       "clickCount"     = "clickCount"     + 1
                   WHERE id = $1"#,
            ),
            "click" => Some(
                r#"UPDATE session_recording
                   SET "clickCount" = "clickCount" + 1
                   WHERE id = $1"#,
            ),
            _ => None,
        };
        if let Some(sql) = update_sql {
            let _ = sqlx::query(sql).bind(rid).execute(&pool).await;
        }
    }

    tracing::info!(
        project = %payload.project_id,
        name    = %payload.name,
        r#type  = %payload.r#type,
        "event tracked"
    );
    Ok(Json(OkResponse { ok: true, id }))
}

// ─── POST /track/pageview ─────────────────────────────────────────────────────

pub async fn track_pageview(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Json(payload): Json<TrackPageViewPayload>,
) -> AppResult<Json<OkResponse>> {
    let api_key = extract_api_key(&headers)?;
    validate_api_key(&pool, &api_key, &payload.project_id).await?;

    let id = Uuid::new_v4().to_string();
    let path = derive_path(&payload.url);

    sqlx::query(
        r#"INSERT INTO page_view
               (id, url, path, referrer, "visitorId", "userId",
                duration, "maxScrollY", "createdAt", "projectId", "recordingId")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)"#,
    )
    .bind(&id)
    .bind(&payload.url)
    .bind(&path)
    .bind(&payload.referrer)
    .bind(&payload.visitor_id)
    .bind(&payload.user_id)
    .bind(payload.duration)
    .bind(payload.max_scroll_y)
    .bind(&payload.project_id)
    .bind(&payload.recording_id)
    .execute(&pool)
    .await?;

    tracing::info!(project = %payload.project_id, url = %payload.url, "pageview tracked");
    Ok(Json(OkResponse { ok: true, id }))
}

// ─── Helpers (pub so other handlers can reuse) ────────────────────────────────

pub fn extract_api_key_pub(headers: &HeaderMap) -> AppResult<String> {
    extract_api_key(headers)
}

pub fn extract_ip_pub(headers: &HeaderMap) -> Option<String> {
    extract_ip(headers)
}

fn extract_api_key(headers: &HeaderMap) -> AppResult<String> {
    if let Some(val) = headers.get("x-api-key") {
        return val
            .to_str()
            .map(String::from)
            .map_err(|_| crate::errors::AppError::Unauthorized("Invalid X-API-Key header".into()));
    }
    if let Some(val) = headers.get("authorization") {
        let raw = val.to_str().map_err(|_| {
            crate::errors::AppError::Unauthorized("Invalid Authorization header".into())
        })?;
        if let Some(token) = raw.strip_prefix("Bearer ") {
            return Ok(token.to_string());
        }
    }
    Err(crate::errors::AppError::Unauthorized(
        "Missing API key — provide X-API-Key header or Authorization: Bearer <key>".into(),
    ))
}

fn extract_ip(headers: &HeaderMap) -> Option<String> {
    headers
        .get("x-forwarded-for")
        .or_else(|| headers.get("x-real-ip"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string())
}

fn derive_path(url: &str) -> String {
    let without_scheme = url
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    let path_start = without_scheme.find('/').unwrap_or(without_scheme.len());
    let full_path = &without_scheme[path_start..];
    let path = full_path
        .split('?')
        .next()
        .and_then(|p| p.split('#').next())
        .unwrap_or(full_path);
    if path.is_empty() {
        "/".to_string()
    } else {
        path.to_string()
    }
}
