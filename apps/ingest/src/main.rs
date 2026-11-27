mod db;
mod errors;
mod handlers;
mod models;
mod workers;

use axum::{
    http::Method,
    routing::{get, options, post},
    Router,
};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use db::ApiKeyCache;
use handlers::{
    error::track_error,
    health::health,
    reports::{events_report, pageviews_report},
    session::{session_frames, session_start},
    track::{track_event, track_pageview},
};
use workers::{EventJob, PageViewJob};

#[derive(Clone)]
pub struct AppState {
    pub db_url: Arc<str>,
    pub key_cache: ApiKeyCache,
    pub event_tx: tokio::sync::mpsc::UnboundedSender<EventJob>,
    pub pv_tx: tokio::sync::mpsc::UnboundedSender<PageViewJob>,
}

impl AppState {
    pub async fn conn(&self) -> Result<sqlx::postgres::PgConnection, sqlx::Error> {
        db::connect(&self.db_url).await
    }
}

async fn preflight() -> axum::http::StatusCode {
    axum::http::StatusCode::OK
}

#[tokio::main]
async fn main() {
    dotenvy::from_path("apps/web/.env").ok();
    dotenvy::from_path("../web/.env").ok();
    dotenvy::from_path(".env").ok();
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "ingest=debug,tower_http=info".into()),
        )
        .init();

    let database_url: Arc<str> = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set")
        .into();

    // Smoke-test the connection at startup so a bad URL fails fast.
    tracing::info!("Testing database connection…");
    db::connect(&database_url)
        .await
        .expect("Failed to connect to Neon PostgreSQL — check DATABASE_URL");
    tracing::info!("Database reachable");

    let (event_tx, event_rx) = tokio::sync::mpsc::unbounded_channel::<EventJob>();
    let (pv_tx, pv_rx) = tokio::sync::mpsc::unbounded_channel::<PageViewJob>();

    tokio::spawn(workers::event_worker(Arc::clone(&database_url), event_rx));
    tokio::spawn(workers::pageview_worker(Arc::clone(&database_url), pv_rx));

    let state = AppState {
        db_url: database_url,
        key_cache: ApiKeyCache::new(),
        event_tx,
        pv_tx,
    };

    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(tower_http::cors::Any)
        .max_age(std::time::Duration::from_secs(86400));

    let app = Router::new()
        .route("/{*path}", options(preflight))
        .route("/health", get(health))
        .route("/track/event", post(track_event))
        .route("/track/pageview", post(track_pageview))
        .route("/track/error", post(track_error))
        .route("/session/start", post(session_start))
        .route("/session/frames", post(session_frames))
        .route("/reports/events", get(events_report))
        .route("/reports/pageviews", get(pageviews_report))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "4000".to_string());
    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    tracing::info!("Ingest listening on http://{addr}");
    axum::serve(listener, app).await.unwrap();
}
