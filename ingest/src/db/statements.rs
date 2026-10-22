// ─── Event inserts ────────────────────────────────────────────────────────────

pub static INSERT_EVENT: &str = r#"
INSERT INTO event (id, type, name, properties, url, sessionId, userId, ipAddress, userAgent, createdAt, projectId)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
"#;

// ─── PageView inserts ─────────────────────────────────────────────────────────

pub static INSERT_PAGE_VIEW: &str = r#"
INSERT INTO page_view (id, url, referrer, sessionId, userId, ipAddress, userAgent, duration, createdAt, projectId)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
"#;

// ─── Event queries ────────────────────────────────────────────────────────────

pub static COUNT_EVENTS: &str = r#"
SELECT COUNT(*) as count
FROM event
WHERE projectId = ? AND createdAt >= datetime('now', ?)
"#;

pub static EVENTS_BY_NAME: &str = r#"
SELECT name, COUNT(*) as count
FROM event
WHERE projectId = ? AND createdAt >= datetime('now', ?)
GROUP BY name
ORDER BY count DESC
LIMIT ?
"#;

pub static RECENT_EVENTS: &str = r#"
SELECT id, type, name, properties, url, sessionId, userId, createdAt, projectId
FROM event
WHERE projectId = ? AND createdAt >= datetime('now', ?)
ORDER BY createdAt DESC
LIMIT ?
"#;

// ─── PageView queries ─────────────────────────────────────────────────────────

pub static COUNT_PAGE_VIEWS: &str = r#"
SELECT COUNT(*) as count
FROM page_view
WHERE projectId = ? AND createdAt >= datetime('now', ?)
"#;

pub static PAGE_VIEWS_BY_URL: &str = r#"
SELECT url, COUNT(*) as count
FROM page_view
WHERE projectId = ? AND createdAt >= datetime('now', ?)
GROUP BY url
ORDER BY count DESC
LIMIT ?
"#;

pub static RECENT_PAGE_VIEWS: &str = r#"
SELECT id, url, referrer, sessionId, userId, duration, createdAt, projectId
FROM page_view
WHERE projectId = ? AND createdAt >= datetime('now', ?)
ORDER BY createdAt DESC
LIMIT ?
"#;
