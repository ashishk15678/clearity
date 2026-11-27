use axum::{extract::State, Json};
use serde_json::{json, Value};

use crate::AppState;

pub async fn health(State(state): State<AppState>) -> Json<Value> {
    let db_ok = state
        .conn()
        .await
        .map(|c| {
            drop(c);
            true
        })
        .unwrap_or(false);

    Json(json!({
        "status":  if db_ok { "ok" } else { "degraded" },
        "service": "ingest",
        "db":      if db_ok { "connected" } else { "error" },
    }))
}
