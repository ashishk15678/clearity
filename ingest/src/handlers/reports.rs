use axum::{Json, extract::{Query, State}};
use sqlx::{PgPool, Row};

use crate::{
    db::project_exists,
    errors::AppResult,
    models::{
        EventRow, EventSummaryRow, EventsReport,
        PageViewRow, PageViewSummaryRow, PageViewsReport, ReportQuery,
    },
};

pub async fn events_report(
    State(pool): State<PgPool>,
    Query(q): Query<ReportQuery>,
) -> AppResult<Json<EventsReport>> {
    project_exists(&pool, &q.project_id).await?;

    // Interval arithmetic without make_interval: multiply days by an interval literal
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM event
           WHERE "projectId" = $1
             AND "createdAt" >= NOW() - ($2 || ' days')::interval"#,
    )
    .bind(&q.project_id)
    .bind(q.days.to_string())
    .fetch_one(&pool)
    .await?;

    let by_name_rows = sqlx::query(
        r#"SELECT name, COUNT(*)::bigint AS count FROM event
           WHERE "projectId" = $1
             AND "createdAt" >= NOW() - ($2 || ' days')::interval
           GROUP BY name
           ORDER BY count DESC
           LIMIT $3"#,
    )
    .bind(&q.project_id)
    .bind(q.days.to_string())
    .bind(q.limit as i64)
    .fetch_all(&pool)
    .await?;

    let by_name = by_name_rows
        .iter()
        .map(|r| EventSummaryRow {
            name:  r.get("name"),
            count: r.get("count"),
        })
        .collect();

    let recent_rows = sqlx::query(
        r#"SELECT id, type, name, properties, url, "visitorId",
                  "createdAt"::text AS created_at, "projectId"
           FROM event
           WHERE "projectId" = $1
             AND "createdAt" >= NOW() - ($2 || ' days')::interval
           ORDER BY "createdAt" DESC
           LIMIT $3"#,
    )
    .bind(&q.project_id)
    .bind(q.days.to_string())
    .bind(q.limit as i64)
    .fetch_all(&pool)
    .await?;

    let recent = recent_rows
        .iter()
        .map(|r| EventRow {
            id:         r.get("id"),
            r#type:     r.get("type"),
            name:       r.get("name"),
            properties: r.get("properties"),
            url:        r.get("url"),
            visitor_id: r.get("visitorId"),
            created_at: r.get::<Option<String>, _>("created_at").unwrap_or_default(),
            project_id: r.get("projectId"),
        })
        .collect();

    Ok(Json(EventsReport {
        project_id: q.project_id,
        days:       q.days,
        total,
        by_name,
        recent,
    }))
}

pub async fn pageviews_report(
    State(pool): State<PgPool>,
    Query(q): Query<ReportQuery>,
) -> AppResult<Json<PageViewsReport>> {
    project_exists(&pool, &q.project_id).await?;

    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM page_view
           WHERE "projectId" = $1
             AND "createdAt" >= NOW() - ($2 || ' days')::interval"#,
    )
    .bind(&q.project_id)
    .bind(q.days.to_string())
    .fetch_one(&pool)
    .await?;

    let top_rows = sqlx::query(
        r#"SELECT path AS url, COUNT(*)::bigint AS count FROM page_view
           WHERE "projectId" = $1
             AND "createdAt" >= NOW() - ($2 || ' days')::interval
           GROUP BY path
           ORDER BY count DESC
           LIMIT $3"#,
    )
    .bind(&q.project_id)
    .bind(q.days.to_string())
    .bind(q.limit as i64)
    .fetch_all(&pool)
    .await?;

    let top_pages = top_rows
        .iter()
        .map(|r| PageViewSummaryRow {
            url:   r.get("url"),
            count: r.get("count"),
        })
        .collect();

    let recent_rows = sqlx::query(
        r#"SELECT id, url, path, referrer, "visitorId", duration,
                  "createdAt"::text AS created_at, "projectId"
           FROM page_view
           WHERE "projectId" = $1
             AND "createdAt" >= NOW() - ($2 || ' days')::interval
           ORDER BY "createdAt" DESC
           LIMIT $3"#,
    )
    .bind(&q.project_id)
    .bind(q.days.to_string())
    .bind(q.limit as i64)
    .fetch_all(&pool)
    .await?;

    let recent = recent_rows
        .iter()
        .map(|r| PageViewRow {
            id:         r.get("id"),
            url:        r.get("url"),
            path:       r.get("path"),
            referrer:   r.get("referrer"),
            visitor_id: r.get("visitorId"),
            duration:   r.get("duration"),
            created_at: r.get::<Option<String>, _>("created_at").unwrap_or_default(),
            project_id: r.get("projectId"),
        })
        .collect();

    Ok(Json(PageViewsReport {
        project_id: q.project_id,
        days:       q.days,
        total,
        top_pages,
        recent,
    }))
}
