//! Background workers that drain the event / pageview queues and write to
//! Postgres in bulk.
//!
//! Each worker opens ONE connection per batch flush — no pool, compatible with
//! Neon's pgBouncer pooler. Batches up to BATCH_MAX rows or flushes after
//! FLUSH_MS of inactivity, whichever comes first. Falls back to individual
//! inserts if the bulk INSERT fails so no data is lost.

use chrono::Utc;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc::UnboundedReceiver;
use tokio::time::timeout;
use uuid::Uuid;

const BATCH_MAX: usize = 500;
const FLUSH_MS: u64 = 50;

pub struct EventJob {
    pub project_id: String,
    pub r#type: String,
    pub name: String,
    pub properties: String,
    pub url: String,
    pub selector: Option<String>,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub visitor_id: Option<String>,
    pub user_id: Option<String>,
    pub recording_id: Option<String>,
}

pub async fn event_worker(db_url: Arc<str>, mut rx: UnboundedReceiver<EventJob>) {
    loop {
        let first = match rx.recv().await {
            Some(j) => j,
            None => break,
        };
        let mut batch = vec![first];
        loop {
            if batch.len() >= BATCH_MAX {
                break;
            }
            match timeout(Duration::from_millis(FLUSH_MS), rx.recv()).await {
                Ok(Some(j)) => batch.push(j),
                _ => break,
            }
        }

        let n = batch.len();
        match crate::db::connect(&db_url).await {
            Err(e) => tracing::error!(err = %e, "event worker: failed to open DB connection"),
            Ok(mut conn) => {
                if let Err(e) = insert_events_bulk(&mut conn, &batch).await {
                    tracing::error!(count = n, err = %e, "event bulk insert failed — retrying individually");
                    for job in &batch {
                        if let Err(e2) = insert_event_single(&mut conn, job).await {
                            tracing::error!(name = %job.name, err = %e2, "event single insert failed");
                        }
                    }
                } else {
                    tracing::debug!(count = n, "events flushed");
                }
            }
        }
    }
}

async fn insert_events_bulk(
    conn: &mut sqlx::postgres::PgConnection,
    batch: &[EventJob],
) -> Result<(), sqlx::Error> {
    let now = Utc::now();
    let mut qb: sqlx::QueryBuilder<sqlx::Postgres> = sqlx::QueryBuilder::new(
        r#"INSERT INTO event
           (id, type, name, properties, url, selector, x, y,
            "visitorId", "userId", "createdAt", "projectId", "recordingId") "#,
    );
    qb.push_values(batch, |mut b, job| {
        b.push_bind(Uuid::new_v4().to_string())
            .push_bind(&job.r#type)
            .push_bind(&job.name)
            .push_bind(&job.properties)
            .push_bind(&job.url)
            .push_bind(&job.selector)
            .push_bind(job.x)
            .push_bind(job.y)
            .push_bind(&job.visitor_id)
            .push_bind(&job.user_id)
            .push_bind(now)
            .push_bind(&job.project_id)
            .push_bind(&job.recording_id);
    });
    qb.build().execute(&mut *conn).await?;
    Ok(())
}

async fn insert_event_single(
    conn: &mut sqlx::postgres::PgConnection,
    job: &EventJob,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO event
           (id, type, name, properties, url, selector, x, y,
            "visitorId", "userId", "createdAt", "projectId", "recordingId")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),$11,$12)"#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&job.r#type)
    .bind(&job.name)
    .bind(&job.properties)
    .bind(&job.url)
    .bind(&job.selector)
    .bind(job.x)
    .bind(job.y)
    .bind(&job.visitor_id)
    .bind(&job.user_id)
    .bind(&job.project_id)
    .bind(&job.recording_id)
    .execute(&mut *conn)
    .await?;
    Ok(())
}

// ─── PageView queue ───────────────────────────────────────────────────────────

pub struct PageViewJob {
    pub project_id: String,
    pub url: String,
    pub path: String,
    pub referrer: Option<String>,
    pub visitor_id: Option<String>,
    pub user_id: Option<String>,
    pub duration: Option<i32>,
    pub max_scroll_y: Option<i32>,
    pub recording_id: Option<String>,
}

pub async fn pageview_worker(db_url: Arc<str>, mut rx: UnboundedReceiver<PageViewJob>) {
    loop {
        let first = match rx.recv().await {
            Some(j) => j,
            None => break,
        };
        let mut batch = vec![first];
        loop {
            if batch.len() >= BATCH_MAX {
                break;
            }
            match timeout(Duration::from_millis(FLUSH_MS), rx.recv()).await {
                Ok(Some(j)) => batch.push(j),
                _ => break,
            }
        }

        let n = batch.len();
        match crate::db::connect(&db_url).await {
            Err(e) => tracing::error!(err = %e, "pageview worker: failed to open DB connection"),
            Ok(mut conn) => {
                if let Err(e) = insert_pageviews_bulk(&mut conn, &batch).await {
                    tracing::error!(count = n, err = %e, "pageview bulk insert failed — retrying individually");
                    for job in &batch {
                        if let Err(e2) = insert_pageview_single(&mut conn, job).await {
                            tracing::error!(url = %job.url, err = %e2, "pageview single insert failed");
                        }
                    }
                } else {
                    tracing::debug!(count = n, "pageviews flushed");
                }
            }
        }
    }
}

async fn insert_pageviews_bulk(
    conn: &mut sqlx::postgres::PgConnection,
    batch: &[PageViewJob],
) -> Result<(), sqlx::Error> {
    let now = Utc::now();
    let mut qb: sqlx::QueryBuilder<sqlx::Postgres> = sqlx::QueryBuilder::new(
        r#"INSERT INTO page_view
           (id, url, path, referrer, "visitorId", "userId",
            duration, "maxScrollY", "createdAt", "projectId", "recordingId") "#,
    );
    qb.push_values(batch, |mut b, job| {
        b.push_bind(Uuid::new_v4().to_string())
            .push_bind(&job.url)
            .push_bind(&job.path)
            .push_bind(&job.referrer)
            .push_bind(&job.visitor_id)
            .push_bind(&job.user_id)
            .push_bind(job.duration)
            .push_bind(job.max_scroll_y)
            .push_bind(now)
            .push_bind(&job.project_id)
            .push_bind(&job.recording_id);
    });
    qb.build().execute(&mut *conn).await?;
    Ok(())
}

async fn insert_pageview_single(
    conn: &mut sqlx::postgres::PgConnection,
    job: &PageViewJob,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO page_view
           (id, url, path, referrer, "visitorId", "userId",
            duration, "maxScrollY", "createdAt", "projectId", "recordingId")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,$10)"#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&job.url)
    .bind(&job.path)
    .bind(&job.referrer)
    .bind(&job.visitor_id)
    .bind(&job.user_id)
    .bind(job.duration)
    .bind(job.max_scroll_y)
    .bind(&job.project_id)
    .bind(&job.recording_id)
    .execute(&mut *conn)
    .await?;
    Ok(())
}
