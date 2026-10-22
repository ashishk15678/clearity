mod db;
mod errors;
mod handlers;
mod models;

use axum::{
    Router,
    http::{Method, HeaderName},
    routing::{get, options, post},
};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use handlers::{
    error::track_error,
    health::health,
    reports::{events_report, pageviews_report},
    session::{session_frames, session_start},
    track::{track_event, track_pageview},
};

/// Respond to any OPTIONS preflight with 200 + CORS headers.
/// This catch-all OPTIONS handler means unknown routes never 404 a preflight.
async fn preflight() -> axum::http::StatusCode {
    axum::http::StatusCode::OK
}

#[tokio::main]
async fn main() {
    dotenvy::from_path("../app/.env").ok();
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "ingest=info,tower_http=debug".into()),
        )
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../app/dev.db".to_string());

    // Normalise: file:./dev.db or file:dev.db → absolute path under ../app/
    let db_url = if database_url.starts_with("file:") {
        let file_part = database_url.trim_start_matches("file:");
        // If it's a bare filename or ./relative, anchor it to ../app/
        let abs = if file_part.starts_with('/') {
            file_part.to_string()
        } else {
            // Strip leading ./ if present
            let bare = file_part.trim_start_matches("./");
            format!("../app/{bare}")
        };
        format!("sqlite:{abs}")
    } else if database_url.starts_with("sqlite:") {
        database_url
    } else {
        format!("sqlite:{database_url}")
    };

    tracing::info!("Connecting: {db_url}");
    let pool = db::create_pool(&db_url).await;
    tracing::info!("DB ready");

    // ── CORS ──────────────────────────────────────────────────────────────────
    // allow_origin(Any) + allow_credentials(true) is rejected by browsers.
    // We use Any origin with no credentials — fine for public ingest APIs.
    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::OPTIONS,
        ])
        .allow_headers([
            HeaderName::from_static("content-type"),
            HeaderName::from_static("x-api-key"),
            HeaderName::from_static("authorization"),
            HeaderName::from_static("x-forwarded-for"),
            HeaderName::from_static("x-real-ip"),
        ])
        .max_age(std::time::Duration::from_secs(86400));

    let app = Router::new()
        // ── Catch-all OPTIONS so browser preflights always get CORS headers ──
        .route("/{*path}", options(preflight))
        // ── Health ────────────────────────────────────────────────────────────
        .route("/health", get(health))
        // ── Tracking ─────────────────────────────────────────────────────────
        .route("/track/event",    post(track_event))
        .route("/track/pageview", post(track_pageview))
        .route("/track/error",    post(track_error))
        // ── Session recording ─────────────────────────────────────────────────
        .route("/session/start",  post(session_start))
        .route("/session/frames", post(session_frames))
        // ── Reports ───────────────────────────────────────────────────────────
        .route("/reports/events",    get(events_report))
        .route("/reports/pageviews", get(pageviews_report))
        // ── Layers ───────────────────────────────────────────────────────────
        // CORS wraps the entire router — every response (including 404s from
        // routes that don't match) gets the CORS headers.
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(pool);

    let addr = "0.0.0.0:4000";
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    tracing::info!("Ingest listening on http://{addr}");
    axum::serve(listener, app).await.unwrap();
}
