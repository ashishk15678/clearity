# Clarity — Suggested Improvements

Observations drawn from the actual codebase. Each item names the file(s) involved, the user/product impact, and the smallest concrete change.

---

## Performance

### 1. Org overview page hits the database five times in parallel — add caching

**File:** `apps/web/app/console/[org]/page.tsx`

Five `prisma.*` calls run via `Promise.all` on every request with no cache. With Next.js 15 `unstable_cache` (or the upcoming stable `use cache`), these can be revalidated on a tag so repeated navigations don't re-query Postgres.

```ts
import { unstable_cache } from "next/cache";

const getOrgStats = unstable_cache(
  async (orgId: string) => { /* the five queries */ },
  ["org-stats"],
  { revalidate: 60, tags: ["org-stats"] },
);
```

Revalidate the tag from any mutation that changes event/project counts.

---

### 2. `project-detail.tsx` is ~2 400 lines in a single file — split into per-tab modules

**File:** `apps/web/app/console/[org]/projects/[slug]/project-detail.tsx`

Every tab's code is bundled and sent to the client regardless of which tab is active. Splitting each tab into a separate file and lazy-loading with `React.lazy` / dynamic imports would cut the initial JS payload significantly. The 8-tab structure makes this mechanical.

```ts
const AnalyticsTab = dynamic(() => import("./tabs/analytics-tab"));
const SessionsTab  = dynamic(() => import("./tabs/sessions-tab"));
// …
```

---

### 3. Session replay renders on every row expansion — virtualize the sessions table

**File:** `apps/web/app/console/[org]/projects/[slug]/project-detail.tsx` — `SessionsTab`

The table fetches 50 rows and mounts `<SessionReplay>` inline when a row is clicked. With more data, the full list stays in the DOM. Use `@tanstack/react-virtual` to virtualise rows so only ~15 are mounted at a time.

---

### 4. No `<link rel="preconnect">` for the Neon database CDN / auth origin

**File:** `apps/web/app/layout.tsx` (root layout, not read in this session)

Add preconnect hints for `NEXT_PUBLIC_BETTER_AUTH_URL` and the Neon pooler hostname so the first auth/DB round trip doesn't pay a full TCP+TLS handshake.

---

## Architecture

### 5. API key in source code — `app/page.tsx` hardcodes a live API key and project ID

**File:** `apps/web/app/page.tsx`

```ts
const API_KEY = "clr_live_kmLHlJCx01U4NAlvz7tvbqQsDLTKTU7l";
const PROJECT_ID = "d4e9e17f-129d-4f7f-8498-ab3717ad5f88";
```

These are committed to the repo. The API key in particular should be rotated and moved to `NEXT_PUBLIC_CLARITY_API_KEY` / `NEXT_PUBLIC_CLARITY_PROJECT_ID` env vars. Even if this is intentional self-dogfooding, a hardcoded live key is a rotation risk.

---

### 6. Ingest calls go directly from the browser — consider a proxy route for sensitive use

**Files:** `apps/web/app/page.tsx`, `project-detail.tsx` (setup snippets)

The tracking script posts directly to the ingest server. This exposes the ingest URL to any visitor. If the ingest server should not be public, a Next.js API route (`/api/ingest/[...path]`) can proxy requests and add server-side validation. At minimum, rate-limit and authenticate the ingest endpoints.

---

### 7. `typescript: { ignoreBuildErrors: true }` in `next.config.ts`

**File:** `apps/web/next.config.ts`

This silently swallows type errors in production builds. Remove it and fix the underlying errors. At minimum, run `tsc --noEmit` in CI so type regressions are caught before they deploy.

---

### 8. Org overview queries Prisma directly; project pages use tRPC — pick one pattern

**Files:** `apps/web/app/console/[org]/page.tsx`, `apps/web/app/console/[org]/projects/[slug]/page.tsx`

Mixing raw Prisma in server components alongside tRPC means business logic is split across two layers. Centralising in tRPC procedures gives you a single place for auth checks, caching, and testing. If raw Prisma in server components is intentional for performance, document the convention so future pages follow one pattern.

---

## Security

### 9. Delete project has no confirmation — destructive mutation on a single click

**File:** `apps/web/app/console/[org]/projects/projects-list.tsx`

```ts
onClick={(e) => {
  e.preventDefault();
  del.mutate({ id: p.id });
}}
```

Deleting a project likely cascades to events, page views, session recordings, and API keys. A confirmation dialog (or at minimum an undo window via optimistic mutation + rollback) prevents accidental data loss.

---

### 10. Error groups expose raw stack traces to any org member — no role check

**File:** `apps/web/app/console/[org]/projects/[slug]/project-detail.tsx` — `ErrorsTab`

Stack traces can contain internal file paths, environment names, and sometimes secrets (via error messages). Consider gating full stack trace display to `admin`/`owner` roles, or at least redacting file paths that look like absolute server paths.

---

## UX / Accessibility

### 11. Tab navigation in `ProjectDetail` is not keyboard-accessible (uses `<button>` but no ARIA tabs pattern)

**File:** `apps/web/app/console/[org]/projects/[slug]/project-detail.tsx`

The tab strip uses `<button>` elements with `border-b-2` active state but no `role="tab"`, `aria-selected`, or `aria-controls`. Screen readers announce these as generic buttons with no relationship to the panel. Add the full WAI-ARIA tabs pattern:

```tsx
<div role="tablist">
  <button role="tab" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}>
    {t.label}
  </button>
</div>
<div role="tabpanel" id={`panel-${t.id}`}>…</div>
```

---

### 12. Stat cards on the overview page all link to the same URL

**File:** `apps/web/app/console/[org]/page.tsx`

Events, Page Views, Sessions, and Open Errors all `href` to `/console/${orgSlug}/projects`. They should deep-link to the relevant tab on the projects page, or to a dedicated reports/errors page, so clicking a stat actually takes the user somewhere useful.

---

### 13. `UserAvatar` uses `size={40}` in the sidebar user pill but renders as a large avatar next to small text

**File:** `apps/web/components/dashboard/sidebar.tsx`

The avatar was 40 px inside a 36 px container row. Already fixed to `size={22}` in this session's redesign, but if `UserAvatar` has no `aria-label` for the image it renders, screen readers get nothing. Confirm `UserAvatar` sets `alt` or `aria-hidden` appropriately.

---

### 14. The `<select>` elements in `reports-view.tsx` have no `<label>`

**File:** `apps/web/app/console/[org]/reports/reports-view.tsx`

Both project and date-range selects have no accessible label. Add visually hidden labels:

```tsx
<label htmlFor="report-project" className="sr-only">Project</label>
<select id="report-project" …>
```

---

## Developer Experience

### 15. No end-to-end tests for the auth → org → project flow

**Files:** none exist yet

The session, membership, and project creation path is the core user journey. A single Playwright test covering signup → create org → create project → view overview would catch regressions from the tRPC router, auth middleware, and DB migrations in one pass.

---

### 16. `apps/ingest` has its own `Cargo.lock` separate from the workspace `Cargo.lock`

**Files:** `Cargo.toml` (root), `apps/ingest/Cargo.lock`

Two lock files mean `cargo update` in the workspace root doesn't update the ingest crate, so dependency versions can silently diverge. Either make `apps/ingest` a workspace member (add it to the root `[workspace]` members array) or document why it is intentionally isolated.

---

### 17. No `loading.tsx` files in the console routes

**Files:** `apps/web/app/console/[org]/` and sub-routes

Next.js uses `loading.tsx` as a Suspense boundary for streaming. Without them, navigating between console pages shows a blank white flash while the server component fetches. Adding skeleton `loading.tsx` files next to each `page.tsx` would make transitions feel instant.

---

*Items marked with a file and line reference are confirmed from source; architecture items are inferred from the patterns present.*
