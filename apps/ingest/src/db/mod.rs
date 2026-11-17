use sqlx::{
    PgPool,
    postgres::{PgConnectOptions, PgPoolOptions},
};
use std::str::FromStr;
use std::time::Duration;

pub async fn create_pool(database_url: &str) -> PgPool {
    let connect_options = PgConnectOptions::from_str(database_url)
        .expect("Invalid PostgreSQL DATABASE_URL")
        // Neon pooler doesn't support named prepared statements
        .statement_cache_capacity(0);

    PgPoolOptions::new()
        // Neon serverless: keep the pool small so we don't exhaust connection
        // limits and don't race on a cold-start compute wake-up.
        // shortcut: single connection, raise to 5-10 on a dedicated Neon plan
        .max_connections(3)
        // Neon computes can take 3-5 s to wake from idle; 30 s is safe
        .acquire_timeout(Duration::from_secs(30))
        // Keep connection alive between requests; Neon bills per active compute
        // second so idle is free — do NOT set a short idle_timeout here
        .connect_with(connect_options)
        .await
        .expect("Failed to connect to Neon PostgreSQL — check DATABASE_URL and network")
}

pub async fn validate_api_key(
    pool: &PgPool,
    api_key: &str,
    project_id: &str,
) -> Result<(), crate::errors::AppError> {
    let row: Option<String> = sqlx::query_scalar(
        r#"SELECT "projectId" FROM api_key
           WHERE key = $1
             AND "revokedAt" IS NULL
             AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_TIMESTAMP)
           LIMIT 1"#,
    )
    .bind(api_key)
    .fetch_optional(pool)
    .await?;

    let found = match row {
        Some(pid) => pid,
        None => {
            tracing::warn!(
                key_prefix = %&api_key[..api_key.len().min(16)],
                "API key not found or revoked"
            );
            return Err(crate::errors::AppError::Unauthorized(
                "API key not found, revoked, or expired".into(),
            ));
        }
    };

    if found != project_id {
        tracing::warn!(
            key_project = %found,
            stated_project = %project_id,
            "API key does not belong to stated project"
        );
        return Err(crate::errors::AppError::Unauthorized(
            "API key does not belong to this project".into(),
        ));
    }

    // Non-fatal last-used update
    let _ = sqlx::query(r#"UPDATE api_key SET "lastUsedAt" = CURRENT_TIMESTAMP WHERE key = $1"#)
        .bind(api_key)
        .execute(pool)
        .await;

    Ok(())
}

pub async fn project_exists(
    pool: &PgPool,
    project_id: &str,
) -> Result<(), crate::errors::AppError> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM project WHERE id = $1)")
            .bind(project_id)
            .fetch_one(pool)
            .await?;

    if !exists {
        return Err(crate::errors::AppError::NotFound(format!(
            "Project '{project_id}' not found"
        )));
    }

    Ok(())
}
