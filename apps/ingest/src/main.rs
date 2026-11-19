mod db;
mod errors;
mod handlers;
mod models;

use axum::{
    http::{HeaderName, Method},
    routing::{get, options, post},
    Router,
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

async fn preflight() -> axum::http::StatusCode {
    axum::http::StatusCode::OK
}

#[tokio::main]
async fn main() {
    dotenvy::from_path("apps/web/.env").ok(); // monorepo root
    dotenvy::from_path("../web/.env").ok(); // apps/ingest/
    dotenvy::from_path(".env").ok(); // local override / production
    dotenvy::dotenv().ok(); // fallback: nearest .env

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "ingest=info,tower_http=debug".into()),
        )
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set (check apps/web/.env or apps/ingest/.env)");

    tracing::info!("Connecting to database…");
    let pool = db::create_pool(&database_url).await;
    tracing::info!("Database ready");

    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        // .allow_headers([
        //     HeaderName::from_static("content-type"),
        //     HeaderName::from_static("x-api-key"),
        //     HeaderName::from_static("authorization"),
        //     HeaderName::from_static("x-forwarded-for"),
        //     HeaderName::from_static("x-real-ip"),
        // ])
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
        .with_state(pool);

    let port = std::env::var("PORT").unwrap_or_else(|_| "4000".to_string());
    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    tracing::info!("Ingest listening on http://{addr}");
    axum::serve(listener, app).await.unwrap();
}
