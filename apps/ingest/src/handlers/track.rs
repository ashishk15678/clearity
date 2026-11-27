use axum::{extract::State, http::HeaderMap, Json};

use crate::{
    db::validate_api_key,
    errors::{AppError, AppResult},
    models::{OkResponse, TrackEventPayload, TrackPageViewPayload},
    workers::{EventJob, PageViewJob},
    AppState,
};

pub async fn track_event(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<TrackEventPayload>,
) -> AppResult<Json<OkResponse>> {
    let api_key = extract_api_key(&headers)?;
    let mut conn = state.conn().await.map_err(AppError::Sqlx)?;
    validate_api_key(&mut conn, &state.key_cache, &api_key, &payload.project_id).await?;

    let id = uuid::Uuid::new_v4().to_string();

    state
        .event_tx
        .send(EventJob {
            project_id: payload.project_id.clone(),
            r#type: payload.r#type.clone(),
            name: payload.name.clone(),
            properties: payload.properties.to_string(),
            url: payload.url.as_deref().unwrap_or("").to_string(),
            selector: payload.selector.clone(),
            x: payload.x,
            y: payload.y,
            visitor_id: payload.visitor_id.clone(),
            user_id: payload.user_id.clone(),
            recording_id: payload.recording_id.clone(),
        })
        .ok();

    // Bump click counters on the recording — small UPDATE, done on the same
    // connection while we still have it open.
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
            let _ = sqlx::query(sql).bind(rid).execute(&mut conn).await;
        }
    }

    tracing::info!(
        project = %payload.project_id,
        name    = %payload.name,
        r#type  = %payload.r#type,
        "event queued"
    );
    Ok(Json(OkResponse { ok: true, id }))
}

pub async fn track_pageview(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<TrackPageViewPayload>,
) -> AppResult<Json<OkResponse>> {
    let api_key = extract_api_key(&headers)?;
    let mut conn = state.conn().await.map_err(AppError::Sqlx)?;
    validate_api_key(&mut conn, &state.key_cache, &api_key, &payload.project_id).await?;

    let id = uuid::Uuid::new_v4().to_string();
    let path = derive_path(&payload.url);

    state
        .pv_tx
        .send(PageViewJob {
            project_id: payload.project_id.clone(),
            url: payload.url.clone(),
            path,
            referrer: payload.referrer.clone(),
            visitor_id: payload.visitor_id.clone(),
            user_id: payload.user_id.clone(),
            duration: payload.duration,
            max_scroll_y: payload.max_scroll_y,
            recording_id: payload.recording_id.clone(),
        })
        .ok();

    tracing::info!(project = %payload.project_id, url = %payload.url, "pageview queued");
    Ok(Json(OkResponse { ok: true, id }))
}

// ─── Helpers (pub so other handlers can reuse) ────────────────────────────────

pub fn extract_api_key(headers: &HeaderMap) -> AppResult<String> {
    if let Some(val) = headers.get("x-api-key") {
        return val
            .to_str()
            .map(String::from)
            .map_err(|_| AppError::Unauthorized("Invalid X-API-Key header".into()));
    }
    if let Some(val) = headers.get("authorization") {
        let raw = val
            .to_str()
            .map_err(|_| AppError::Unauthorized("Invalid Authorization header".into()))?;
        if let Some(token) = raw.strip_prefix("Bearer ") {
            return Ok(token.to_string());
        }
    }
    Err(AppError::Unauthorized(
        "Missing API key — provide X-API-Key or Authorization: Bearer <key>".into(),
    ))
}

pub fn extract_ip(headers: &HeaderMap) -> Option<String> {
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
