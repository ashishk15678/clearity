# Clarity — High-Level Design

## 1. System Overview

Clarity is a self-hosted, privacy-first product analytics platform.  
It captures page views, custom events, session recordings, errors, and frustration signals from any web page, stores them in a managed Postgres database (Neon), and surfaces them in a multi-tenant Next.js dashboard.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Customer page (any site)                                                    │
│                                                                              │
│   <script src="https://your-clarity.com/clarity.js"                         │
│           data-project-id="…" data-api-key="…" data-ingest="…">             │
│                                                                              │
│   SDK (clarity.js)  ──────────────────────────────────────────────────────► │
│     page views / events / errors / sessions / tours                         │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ HTTP POST  (port 4000)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  apps/ingest  (Rust / Axum)                                                 │
│                                                                              │
│  Routes:                                                                     │
│    POST /track/event       POST /track/pageview    POST /track/error         │
│    POST /session/start     POST /session/frames                              │
│    GET  /reports/events    GET  /reports/pageviews  GET /health              │
│                                                                              │
│  Validates API key → writes to Postgres                                      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ Postgres (Neon)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Neon Postgres                                                               │
│                                                                              │
│  Tables (Prisma-managed schema):                                             │
│    user, session, account, verification                                      │
│    organization, organization_member, team, team_member, invite              │
│    project, api_key                                                          │
│    event, page_view                                                          │
│    session_recording, session_recording_chunk                                │
│    error_group, error_event                                                  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ Prisma (pg adapter) + tRPC
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  apps/web  (Next.js 16 / React 19)                                          │
│                                                                              │
│  Routes:                                                                     │
│    /                        landing / SDK test harness                       │
│    /login  /signup                                                           │
│    /console                 → redirect to /console/[org]                    │
│    /console/[org]           overview dashboard                               │
│    /console/[org]/projects  project list + create                            │
│    /console/[org]/projects/[slug]  events/errors/sessions/analytics tabs    │
│    /console/[org]/teams     members + invites + teams                        │
│    /console/[org]/tours     tour builder                                     │
│    /console/[org]/reports   cross-project analytics                          │
│    /console/[org]/billing   plan info (static)                               │
│    /console/[org]/settings  profile / endpoints / sign-out                  │
│    /invite/[token]          accept org invite                                │
│    /api/trpc/[trpc]         tRPC API                                         │
│    /api/auth/[...all]       better-auth API                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Monorepo Layout

```
clarity-2/
├── apps/
│   ├── ingest/        Rust/Axum ingest service  (port 4000)
│   ├── web/           Next.js dashboard          (port 3000)
│   └── ops/           CI/CD, Docker, infra
├── packages/
│   └── sdk/           TypeScript source for clarity.js
│                      Build output → apps/web/public/clarity.js
├── Cargo.toml         Rust workspace (members: ["apps/ingest"])
├── pnpm-workspace.yaml
├── turbo.json
├── package.json       Root scripts (pnpm + cargo)
├── HLD.md             ← this file
└── LLD.md             Low-Level Design
```

## 3. Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Ingest language | Rust/Axum | Zero GC pauses, single binary, cheap hosting |
| Dashboard framework | Next.js 16 App Router | SSR, server components, Vercel-ready |
| Database | Neon (Postgres) | Serverless, branching, familiar SQL |
| ORM | Prisma 7 (pg adapter) | Type-safe, schema-driven |
| API layer | tRPC v11 | End-to-end types, no REST overhead |
| Auth | better-auth | Lightweight, email/password, session table |
| SDK | Vanilla JS IIFE | No bundler dependency, works on any page |
| Multi-tenancy | Organization slug in URL | Shareable deep links, clear access scope |

## 4. Data Flow

### 4a. Tracking event (SDK → Ingest → DB)

```
SDK.track("purchase", {amount:99})
  └─► POST /track/event  { project_id, type, name, properties, url, visitor_id }
        └─► validate_api_key(key, project_id)   [api_key table]
        └─► INSERT INTO event (…)
        └─► 200 { ok: true, id: "<uuid>" }
```

### 4b. Dashboard reads (Browser → tRPC → Prisma → DB)

```
Browser (React Query)
  └─► POST /api/trpc/events.list  { projectId, limit }
        └─► requireProjectAccess(userId, projectId)
        └─► prisma.event.findMany(…)
        └─► JSON response
```

### 4c. Session recording

```
SDK (page load)
  └─► POST /session/start  { project_id, visitor_id, start_url, viewport_w/h }
        └─► INSERT/upsert session_recording

SDK (every 5s + pagehide)
  └─► POST /session/frames { project_id, visitor_id, frames[], duration, is_final }
        └─► INSERT session_recording_chunk (append-only, sequence++)
        └─► UPDATE session_recording SET duration, exitUrl

Dashboard replay
  └─► tRPC sessions.byId → includes chunks ordered by sequence
      → reassemble frame stream → canvas replay + heatmap
```

## 5. Security Model

- API keys validate project ownership on every ingest request
- Session tokens (better-auth) gated on every tRPC procedure via `protectedProcedure`
- Org membership checked per-request; role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
- SDK: no credentials, no cookies — `credentials: "omit"` on all fetch calls
- PII: input values never recorded (only length); text optionally masked with `data-clarity-mask`
- DNT / GPC headers respected in SDK

## 6. Deployment Topology

```
                 ┌──────────────────────────────────────┐
Internet ──────► │  Vercel (or any Node host)           │
                 │  apps/web  (Next.js)                 │
                 └───────────────────┬──────────────────┘
                                     │ DB
                 ┌───────────────────▼──────────────────┐
                 │  Neon Postgres                        │
                 │  (connection pooler enabled)          │
                 └───────────────────▲──────────────────┘
                                     │ DB
                 ┌───────────────────┴──────────────────┐
Internet ──────► │  Fly.io / Railway / VPS               │
                 │  apps/ingest  (Rust binary)           │
                 │  PORT=4000                            │
                 └──────────────────────────────────────┘
```
