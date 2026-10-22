pub mod statements;

use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};

pub async fn create_pool(database_url: &str) -> SqlitePool {
    SqlitePoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
        .expect("Failed to connect to SQLite database")
}

/// Validate that an API key exists and belongs to the given project.
///
/// Two-step check:
/// 1. Does the key exist, is not revoked, and not expired? (key-only lookup)
/// 2. Does it belong to the stated project_id?
///
/// This split gives us a cleaner error message for debugging.
pub async fn validate_api_key(
    pool: &SqlitePool,
    api_key: &str,
    project_id: &str,
) -> Result<(), crate::errors::AppError> {
    // Step 1: find the key regardless of project
    let row = sqlx::query!(
        r#"
        SELECT id, projectId
        FROM api_key
        WHERE key = ?
          AND revokedAt IS NULL
          AND (expiresAt IS NULL OR expiresAt > datetime('now'))
        LIMIT 1
        "#,
        api_key,
    )
    .fetch_optional(pool)
    .await?;

    let key_row = match row {
        Some(r) => r,
        None => {
            tracing::warn!(key_prefix = %&api_key[..api_key.len().min(16)], "API key not found or revoked");
            return Err(crate::errors::AppError::Unauthorized(
                "API key not found, revoked, or expired".to_string(),
            ));
        }
    };

    // Step 2: verify it belongs to the stated project
    if key_row.projectId != project_id {
        tracing::warn!(
            key_project = %key_row.projectId,
            stated_project = %project_id,
            "API key does not belong to stated project"
        );
        return Err(crate::errors::AppError::Unauthorized(
            "API key does not belong to this project".to_string(),
        ));
    }

    // Update lastUsedAt (non-fatal if it fails)
    let _ = sqlx::query!(
        "UPDATE api_key SET lastUsedAt = datetime('now') WHERE key = ?",
        api_key,
    )
    .execute(pool)
    .await;

    Ok(())
}

/// Validate that project_id exists (for report reads).
pub async fn project_exists(
    pool: &SqlitePool,
    project_id: &str,
) -> Result<(), crate::errors::AppError> {
    let row = sqlx::query!("SELECT id FROM project WHERE id = ? LIMIT 1", project_id)
        .fetch_optional(pool)
        .await?;

    if row.is_none() {
        return Err(crate::errors::AppError::NotFound(format!(
            "Project '{project_id}' not found"
        )));
    }

    Ok(())
}
