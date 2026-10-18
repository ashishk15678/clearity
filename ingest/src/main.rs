use axum::{Router, routing::get};
use sqlx::sqlite::SqlitePoolOptions;
use tokio::net::TcpListener;
pub mod db;
use db::statements;

#[tokio::main]
pub async fn main() {
    let database_url = "sqlite://../app/dev.db";
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await
        .unwrap();
    let row: (i32,) = match sqlx::query_as(statements::USERS).fetch_one(&pool).await {
        Ok(val) => val,
        Err(_) => {
            println!("No such rows");
            (1,)
        }
    };

    println!("Query result: {row:?}");

    let app = Router::new().route("/", get(|| async { "Hello" }));
    let listener = TcpListener::bind("0.0.0.0:3000").await.unwrap();
    let _ = axum::serve(listener, app).await;
}
