use axum::{Json, extract::State};
use serde_json::{Value, json};
use sqlx::SqlitePool;

/// GET /health
/// Returns 200 with service status and a DB ping.
pub async fn health(State(pool): State<SqlitePool>) -> Json<Value> {
    let db_ok = sqlx::query("SELECT 1")
        .fetch_one(&pool)
        .await
        .is_ok();

    Json(json!({
        "status": if db_ok { "ok" } else { "degraded" },
        "service": "ingest",
        "db": if db_ok { "connected" } else { "error" },
    }))
}
