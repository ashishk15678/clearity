use serde::{Deserialize, Serialize};

// ─── Track Event ──────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TrackEventPayload {
    pub project_id: String,
    #[serde(default = "default_custom")]
    pub r#type: String,
    pub name: String,
    #[serde(default)]
    pub properties: serde_json::Value,
    pub url: Option<String>,
    pub selector: Option<String>,
    pub x: Option<i64>,
    pub y: Option<i64>,
    pub visitor_id: Option<String>,
    pub user_id: Option<String>,
    pub recording_id: Option<String>,
}

fn default_custom() -> String { "custom".to_string() }

// ─── Track PageView ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TrackPageViewPayload {
    pub project_id: String,
    pub url: String,
    pub referrer: Option<String>,
    pub visitor_id: Option<String>,
    pub user_id: Option<String>,
    pub duration: Option<i64>,
    pub max_scroll_y: Option<i64>,
    pub recording_id: Option<String>,
}

// ─── Track Error ──────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TrackErrorPayload {
    pub project_id: String,
    pub message: String,
    pub stack: Option<String>,
    pub r#type: Option<String>,
    pub url: Option<String>,
    pub line: Option<i64>,
    pub col: Option<i64>,
    pub visitor_id: Option<String>,
    pub user_agent: Option<String>,
    #[serde(default)]
    pub breadcrumbs: serde_json::Value,
}

// ─── Session Start ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SessionStartPayload {
    pub project_id: String,
    pub visitor_id: String,
    pub start_url: String,
    pub user_agent: Option<String>,
    pub viewport_w: Option<i64>,
    pub viewport_h: Option<i64>,
}

// ─── Session Frames ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SessionFramesPayload {
    pub project_id: String,
    pub visitor_id: String,
    #[serde(default)]
    pub frames: serde_json::Value,
    #[serde(default)]
    pub duration: i64,
    pub exit_url: Option<String>,
}

// ─── Report query params ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ReportQuery {
    pub project_id: String,
    #[serde(default = "default_days")]
    pub days: u32,
    #[serde(default = "default_limit")]
    pub limit: u32,
}

fn default_days() -> u32 { 7 }
fn default_limit() -> u32 { 20 }

// ─── Shared response ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct OkResponse {
    pub ok: bool,
    pub id: String,
}

// ─── Report rows ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct EventRow {
    pub id: String,
    pub r#type: String,
    pub name: String,
    pub properties: String,
    pub url: Option<String>,
    pub visitor_id: Option<String>,
    pub created_at: String,
    pub project_id: String,
}

#[derive(Debug, Serialize)]
pub struct PageViewRow {
    pub id: String,
    pub url: String,
    pub path: String,
    pub referrer: Option<String>,
    pub visitor_id: Option<String>,
    pub duration: Option<i64>,
    pub created_at: String,
    pub project_id: String,
}

#[derive(Debug, Serialize)]
pub struct EventSummaryRow {
    pub name: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct PageViewSummaryRow {
    pub url: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct EventsReport {
    pub project_id: String,
    pub days: u32,
    pub total: i64,
    pub by_name: Vec<EventSummaryRow>,
    pub recent: Vec<EventRow>,
}

#[derive(Debug, Serialize)]
pub struct PageViewsReport {
    pub project_id: String,
    pub days: u32,
    pub total: i64,
    pub top_pages: Vec<PageViewSummaryRow>,
    pub recent: Vec<PageViewRow>,
}
