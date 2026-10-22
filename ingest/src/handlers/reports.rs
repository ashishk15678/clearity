use axum::{Json, extract::{Query, State}};
use sqlx::SqlitePool;

use crate::{
    db::project_exists,
    errors::AppResult,
    models::{
        EventRow, EventSummaryRow, EventsReport,
        PageViewRow, PageViewSummaryRow, PageViewsReport, ReportQuery,
    },
};

// ─── GET /reports/events ──────────────────────────────────────────────────────

pub async fn events_report(
    State(pool): State<SqlitePool>,
    Query(q): Query<ReportQuery>,
) -> AppResult<Json<EventsReport>> {
    project_exists(&pool, &q.project_id).await?;

    let since = format!("-{} days", q.days);
    let limit = q.limit as i64;

    let total = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM event WHERE projectId = ? AND createdAt >= datetime('now', ?)",
        q.project_id, since,
    )
    .fetch_one(&pool)
    .await?;

    let by_name_rows = sqlx::query!(
        r#"SELECT name, COUNT(*) as count FROM event
           WHERE projectId = ? AND createdAt >= datetime('now', ?)
           GROUP BY name ORDER BY count DESC LIMIT ?"#,
        q.project_id, since, limit,
    )
    .fetch_all(&pool)
    .await?;

    let by_name = by_name_rows.into_iter()
        .map(|r| EventSummaryRow { name: r.name, count: r.count })
        .collect();

    let recent_rows = sqlx::query!(
        r#"SELECT id, type, name, properties, url, visitorId,
                  CAST(createdAt AS TEXT) as "createdAt", projectId
           FROM event
           WHERE projectId = ? AND createdAt >= datetime('now', ?)
           ORDER BY createdAt DESC LIMIT ?"#,
        q.project_id, since, limit,
    )
    .fetch_all(&pool)
    .await?;

    let recent = recent_rows.into_iter()
        .map(|r| EventRow {
            id: r.id,
            r#type: r.r#type,
            name: r.name,
            properties: r.properties,
            url: r.url,
            visitor_id: r.visitorId,
            created_at: r.createdAt,
            project_id: r.projectId,
        })
        .collect();

    Ok(Json(EventsReport { project_id: q.project_id, days: q.days, total, by_name, recent }))
}

// ─── GET /reports/pageviews ───────────────────────────────────────────────────

pub async fn pageviews_report(
    State(pool): State<SqlitePool>,
    Query(q): Query<ReportQuery>,
) -> AppResult<Json<PageViewsReport>> {
    project_exists(&pool, &q.project_id).await?;

    let since = format!("-{} days", q.days);
    let limit = q.limit as i64;

    let total = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM page_view WHERE projectId = ? AND createdAt >= datetime('now', ?)",
        q.project_id, since,
    )
    .fetch_one(&pool)
    .await?;

    // Group by `path` (clean path) rather than full URL
    let top_rows = sqlx::query!(
        r#"SELECT path as url, COUNT(*) as count FROM page_view
           WHERE projectId = ? AND createdAt >= datetime('now', ?)
           GROUP BY path ORDER BY count DESC LIMIT ?"#,
        q.project_id, since, limit,
    )
    .fetch_all(&pool)
    .await?;

    let top_pages = top_rows.into_iter()
        .map(|r| PageViewSummaryRow { url: r.url, count: r.count })
        .collect();

    let recent_rows = sqlx::query!(
        r#"SELECT id, url, path, referrer, visitorId, duration,
                  CAST(createdAt AS TEXT) as "createdAt", projectId
           FROM page_view
           WHERE projectId = ? AND createdAt >= datetime('now', ?)
           ORDER BY createdAt DESC LIMIT ?"#,
        q.project_id, since, limit,
    )
    .fetch_all(&pool)
    .await?;

    let recent = recent_rows.into_iter()
        .map(|r| PageViewRow {
            id: r.id,
            url: r.url,
            path: r.path,
            referrer: r.referrer,
            visitor_id: r.visitorId,
            duration: r.duration,
            created_at: r.createdAt,
            project_id: r.projectId,
        })
        .collect();

    Ok(Json(PageViewsReport { project_id: q.project_id, days: q.days, total, top_pages, recent }))
}
