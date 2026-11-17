# Clarity — Low-Level Design

## 1. API Contract: Ingest Service (port 4000)

All endpoints accept and return JSON. Auth via `X-API-Key: <key>` header.  
API key ownership is validated against the `project_id` in every request body.

---

### POST /track/event

**Request body** (all optional fields are `null`-safe):

```jsonc
{
  "project_id":  "string (uuid)   required",
  "type":        "string          default: 'custom'  | 'click' | 'rage_click' | 'dead_click'",
  "name":        "string          required",
  "properties":  "object          default: {}",
  "url":         "string | null",
  "selector":    "string | null   CSS descriptor of clicked element",
  "x":           "int | null      viewport px",
  "y":           "int | null      viewport px",
  "visitor_id":  "string | null   persistent anonymous ID",
  "user_id":     "string | null   identified user (from clarity.identify())",
  "recording_id":"string | null"
}
```

**Response:** `{ "ok": true, "id": "<uuid>" }`

**Side effects:**
- Increments `session_recording.clickCount / rageClickCount / deadClickCount` when `recording_id` present and type is click variant.

---

### POST /track/pageview

**Request body:**

```jsonc
{
  "project_id":    "string  required",
  "url":           "string  required   full URL",
  "referrer":      "string | null",
  "visitor_id":    "string | null",
  "user_id":       "string | null",
  "duration":      "int | null   ms of visible time (sent on page exit)",
  "max_scroll_y":  "int | null   0-100 % scroll depth (sent on page exit)",
  "recording_id":  "string | null",
  "pageview_id":   "string | null   SDK-generated UUID for idempotent update",
  "_update":       "bool | null    true = this is a finalization update, not a new view"
}
```

**Response:** `{ "ok": true, "id": "<uuid>" }`

**Note:** The SDK sends this twice per page — once on load (without duration/scroll),  
and once on exit (with duration/scroll). The ingest service always INSERTs; deduplication  
by `pageview_id` is intentionally left to the query layer (GROUP BY pageview_id, take latest).

---

### POST /track/error

**Request body:**

```jsonc
{
  "project_id":  "string  required",
  "message":     "string  required   clipped to 500 chars",
  "stack":       "string | null      clipped to 4000 chars",
  "type":        "string | null      'error' | 'unhandledrejection'",
  "url":         "string | null",
  "line":        "int | null",
  "col":         "int | null",
  "visitor_id":  "string | null",
  "user_agent":  "string | null",
  "breadcrumbs": "array             last 30 SDK breadcrumbs before the error"
}
```

**Response:** `{ "ok": true, "id": "<uuid>" }`

**Side effects:** Upserts `error_group` (fingerprint = hash of `message|stack[0]`),  
increments `session_recording.errorCount`.

---

### POST /session/start

**Request body:**

```jsonc
{
  "project_id":  "string  required",
  "visitor_id":  "string  required",
  "start_url":   "string  required",
  "user_agent":  "string | null",
  "viewport_w":  "int | null",
  "viewport_h":  "int | null",
  "sampled":     "bool | null   whether this session is being recorded"
}
```

**Response:** `{ "ok": true, "id": "<session_recording_id>" }`

**Idempotent:** returns existing recording if one already exists for `(visitor_id, project_id)`.

---

### POST /session/frames

**Request body:**

```jsonc
{
  "project_id":    "string  required",
  "visitor_id":    "string  required",
  "frames":        "array             replay frame objects",
  "duration":      "int    default: 0   ms since page load",
  "exit_url":      "string | null",
  "is_final":      "bool | null        true = page is unloading"
}
```

**Response:** `{ "ok": true, "id": "<chunk_id>" }`

**Frame object:**

```jsonc
{ "type": "snapshot|mouse|click|scroll|input|resize|nav|custom",
  "ts":   1234,
  "d":    { /* type-specific payload */ } }
```

---

### GET /reports/events?project_id=&days=7&limit=20

Returns aggregated event data (bypasses auth — intended for server-to-server).  
In production: add middleware to require an internal token.

### GET /reports/pageviews?project_id=&days=7&limit=20

Same pattern.

### GET /health

Returns `{ "status": "ok" }`. No auth.

---

## 2. SDK API (clarity.js)

Injected as `window.clarity` after the script loads.

```ts
// Track a custom event
clarity.track(name: string, properties?: Record<string, unknown>): void

// Identify the visitor (links analytics to your user ID)
clarity.identify(userId: string, traits?: Record<string, unknown>): void

// Flush pending pageview + frames immediately (call before SPA unmount if needed)
clarity.flush(): void

// Consent: suppress all tracking and recording
clarity.optOut(): void   // persists to localStorage
clarity.optIn(): void    // removes the opt-out flag

// Product tours
clarity.tour(steps: TourStep[], options?: TourOptions): void

// TourStep
{
  target?:    string    // CSS selector. Omit for a centered full-screen modal.
  title?:     string
  body?:      string
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'center'
}

// TourOptions
{
  storageKey?: string    // localStorage key; defaults to 'clarity_tour_default'
  forceShow?:  boolean   // show even if already completed
  onComplete?: () => void
  onSkip?:     () => void
}
```

**Script attributes:**

```html
<script
  src="/clarity.js"
  data-project-id="uuid"
  data-api-key="clr_live_…"
  data-ingest="https://ingest.yourapp.com"
  data-sample-rate="1"      <!-- 0–1, fraction of sessions to record -->
  data-mask-text="false"    <!-- 'true' masks all text in recordings -->
></script>
```

**Privacy element attributes:**

```html
<div data-clarity-mask>…</div>    <!-- text replaced with ●●● in recordings -->
<div data-clarity-block>…</div>   <!-- element replaced with grey box -->
```

---

## 3. tRPC Router Map

All procedures are behind `protectedProcedure` (requires valid session).  
Org and project access is verified per-call.

```
auth.*                   better-auth session helpers
org.list                 → all orgs for current user
org.bySlug(slug)         → org + members + teams + invites
org.create/update/delete
org.invite/acceptInvite/revokeInvite/listInvites
org.createTeam/updateTeam/deleteTeam/listTeams
org.addTeamMember/removeTeamMember
org.updateMemberRole/removeMember

projects.list(organizationId)        → projects in org (uses DB id, not slug)
projects.byId / bySlug
projects.create / update / delete
projects.listApiKeys / createApiKey / revokeApiKey

events.list(projectId, cursor?, limit?, name?, type?)
events.summary(projectId, days)
events.timeSeries(projectId, days)

reports.overview(projectId, days)         → KPIs + top pages/events
reports.pageViewTimeSeries(projectId, days)
reports.scrollDepth(projectId, days)      → avg/p50/p75/p90 per path
reports.referrers(projectId, days)        → traffic sources
reports.activityByHour(projectId, days)   → 7×24 heatmap grid
reports.frustration(projectId, days)      → rage/dead click rates
reports.clickHeatmap(projectId, path, days)
reports.pagePerformance(projectId, days)

sessions.list(projectId, limit)
sessions.byId(id)                         → includes chunks for replay
sessions.stats(projectId, days)

errors.list(projectId, status?, limit)
errors.groupById(id)                      → includes events (stack+breadcrumbs)
errors.updateStatus(id, status)
errors.stats(projectId, days)
```

---

## 4. Database Schema Summary

```
organization (id, name, slug*, ownerId)
organization_member (id, organizationId, userId, role)  @@unique([orgId,userId])
team / team_member
invite (token*, email, role, expiresAt, acceptedAt)

project (id, slug, organizationId)  @@unique([organizationId, slug])
api_key (id, key*, projectId, revokedAt, lastUsedAt)

event (id, type, name, properties, url, selector, x, y,
       visitorId, userId, createdAt, projectId, recordingId)
  @@index([projectId, createdAt])
  @@index([projectId, type, url])    ← heatmap queries

page_view (id, url, path, referrer, visitorId, duration, maxScrollY,
           createdAt, projectId, recordingId)
  @@index([projectId, createdAt])
  @@index([projectId, path])

session_recording (id, visitorId, startUrl, exitUrl, userAgent, ipAddress,
                   viewportW, viewportH, duration, clickCount, rageClickCount,
                   deadClickCount, errorCount, deviceType, browser, os,
                   createdAt, updatedAt, projectId)
  @@index([projectId, createdAt])

session_recording_chunk (id, recordingId, sequence*, framesCount, frames,
                         createdAt)
  @@unique([recordingId, sequence])    ← prevents sequence races

error_group (id, fingerprint, message, type, status, occurrences,
             firstSeenAt, lastSeenAt, resolvedAt, projectId)
  @@unique([projectId, fingerprint])

error_event (id, message, stack, url, line, col, userAgent, ipAddress,
             visitorId, breadcrumbs, createdAt, groupId, projectId, recordingId)
```

---

## 5. Known Intentional Simplifications

| Area | Current state | Upgrade path |
|---|---|---|
| Pageview dedup | SDK sends two rows (load + exit); queries ignore `_update` flag | Add `pageview_id` unique constraint + ON CONFLICT DO UPDATE |
| Rate limiting | None on ingest | Add Axum `tower_governor` middleware |
| Email delivery | Invite URL returned in response only | Plug in Resend/Postmark in `orgs.invite` |
| Session replay | Lightweight custom DOM snapshot, not rrweb | Drop-in rrweb with same chunk format |
| Ingest auth | API key validated per-request (N+1 on pool) | Redis cache with 60s TTL |
| Error grouping | Simple `message|stack[0]` hash fingerprint | Add source-map resolution + smarter grouping |
