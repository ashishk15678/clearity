use hmac::{Hmac, Mac};
use sha2::Sha256;
use sqlx::postgres::{PgConnectOptions, PgConnection};
use sqlx::Connection;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

type HmacSha256 = Hmac<Sha256>;

pub async fn connect(database_url: &str) -> Result<PgConnection, sqlx::Error> {
    let opts = PgConnectOptions::from_str(database_url)
        .expect("Invalid DATABASE_URL")
        .statement_cache_capacity(0); // pgBouncer transaction mode
    PgConnection::connect_with(&opts).await
}

const CACHE_TTL: Duration = Duration::from_secs(300); // 5 min

#[derive(Clone)]
struct CacheEntry {
    inserted_at: Instant,
}

#[derive(Clone, Default)]
pub struct ApiKeyCache(Arc<Mutex<HashMap<String, CacheEntry>>>);

impl ApiKeyCache {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(HashMap::new())))
    }

    pub fn get(&self, key_id: &str, project_id: &str) -> bool {
        let ck = format!("{}:{}", key_id, project_id);
        let map = self.0.lock().unwrap();
        map.get(&ck)
            .map(|e| e.inserted_at.elapsed() < CACHE_TTL)
            .unwrap_or(false)
    }

    pub fn insert(&self, key_id: &str, project_id: &str) {
        let ck = format!("{}:{}", key_id, project_id);
        let mut map = self.0.lock().unwrap();
        if map.len() > 10_000 {
            map.retain(|_, v| v.inserted_at.elapsed() < CACHE_TTL);
        }
        map.insert(ck, CacheEntry { inserted_at: Instant::now() });
    }
}

struct ParsedToken<'a> {
    key_id:  &'a str,
    mac_hex: &'a str,
}

fn parse_token(raw: &str) -> Option<ParsedToken<'_>> {
    // "clr.<keyId>.<mac>"
    let rest = raw.strip_prefix("clr.")?;
    let dot = rest.find('.')?;
    Some(ParsedToken {
        key_id:  &rest[..dot],
        mac_hex: &rest[dot + 1..],
    })
}

// ─── Validation ───────────────────────────────────────────────────────────────

pub async fn validate_api_key(
    conn: &mut PgConnection,
    cache: &ApiKeyCache,
    raw_token: &str,
    project_id: &str,
) -> Result<(), crate::errors::AppError> {
    let parsed = parse_token(raw_token).ok_or_else(|| {
        crate::errors::AppError::Unauthorized(
            "Malformed API key — expected clr.<id>.<mac>".into(),
        )
    })?;

    // 1. Cache hit — O(1), no DB, no crypto.
    if cache.get(parsed.key_id, project_id) {
        return Ok(());
    }

    // 2. Fetch secretHash + projectId by keyId (single indexed PK lookup).
    let row: Option<(String, String)> = sqlx::query_as(
        r#"SELECT "secretHash", "projectId" FROM api_key
           WHERE "keyId" = $1
             AND "revokedAt" IS NULL
             AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_TIMESTAMP)
           LIMIT 1"#,
    )
    .bind(parsed.key_id)
    .fetch_optional(&mut *conn)
    .await?;

    let (secret_hash, db_project_id) = match row {
        Some(r) => r,
        None => {
            tracing::warn!(key_id = %parsed.key_id, "API key not found or revoked");
            return Err(crate::errors::AppError::Unauthorized(
                "API key not found, revoked, or expired".into(),
            ));
        }
    };

    // 3. Project binding check (pre-trim; definitive check is in step 4).
    if db_project_id != project_id {
        tracing::warn!(
            key_id         = %parsed.key_id,
            key_project    = %db_project_id,
            stated_project = %project_id,
            "project mismatch (pre-trim)"
        );
        return Err(crate::errors::AppError::Unauthorized(
            "API key does not belong to this project".into(),
        ));
    }

    // 4. Recompute HMAC(secretHash, projectId) and compare constant-time.
    // Trim both values — Postgres TEXT columns occasionally pad with whitespace.
    let secret_hash = secret_hash.trim();
    let db_project_id_trimmed = db_project_id.trim();
    // Re-check project binding after trim (defensive)
    if db_project_id_trimmed != project_id.trim() {
        return Err(crate::errors::AppError::Unauthorized(
            "API key does not belong to this project".into(),
        ));
    }
    let project_id = project_id.trim();

    let mut mac = HmacSha256::new_from_slice(secret_hash.as_bytes())
        .expect("HMAC accepts any key length");
    mac.update(project_id.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());

    let token_bytes    = hex_to_bytes(parsed.mac_hex);
    let expected_bytes = hex_to_bytes(&expected);

    tracing::debug!(
        key_id      = %parsed.key_id,
        project_id  = %project_id,
        mac_in_token = %parsed.mac_hex,
        mac_expected = %expected,
        secret_hash_len = %secret_hash.len(),
        "HMAC check"
    );

    if token_bytes.len() != expected_bytes.len()
        || !constant_time_eq(&token_bytes, &expected_bytes)
    {
        tracing::warn!(
            key_id       = %parsed.key_id,
            project_id   = %project_id,
            token_mac    = %parsed.mac_hex,
            expected_mac = %expected,
            "HMAC mismatch — token was signed with a different projectId or secretHash"
        );
        return Err(crate::errors::AppError::Unauthorized(
            "API key signature invalid".into(),
        ));
    }

    // 5. Cache for 5 min — subsequent requests from this SDK hit cost nothing.
    cache.insert(parsed.key_id, project_id);

    Ok(())
}

pub async fn project_exists(
    conn: &mut PgConnection,
    project_id: &str,
) -> Result<(), crate::errors::AppError> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM project WHERE id = $1)")
            .bind(project_id)
            .fetch_one(&mut *conn)
            .await?;
    if !exists {
        return Err(crate::errors::AppError::NotFound(format!(
            "Project '{project_id}' not found"
        )));
    }
    Ok(())
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn hex_to_bytes(hex: &str) -> Vec<u8> {
    (0..hex.len())
        .step_by(2)
        .filter_map(|i| u8::from_str_radix(hex.get(i..i + 2)?, 16).ok())
        .collect()
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() { return false; }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}
