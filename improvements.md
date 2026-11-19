# Clarity — Remaining Improvements

Items already fixed in code are removed. What follows is ordered by impact: biggest user/product risk first, developer experience last.

---

## P0 — Security / data integrity

### 1. Ingest URL is public — authenticate and rate-limit the ingest endpoints

**Files:** `apps/web/app/page.tsx`, `apps/ingest/src/handlers/track.rs`

The tracking script posts directly to the ingest server from every visitor's browser, which means the ingest URL is visible in page source. Any observer can flood it with fake events. At minimum:

- Validate `X-API-Key` on every ingest route (already a header in the setup snippets — confirm the Rust handler rejects missing/invalid keys).
- Add a per-key rate limit (e.g. 1 000 req/min) in the Axum middleware layer.
- If the ingest server must stay private, add a Next.js proxy route `/api/ingest/[...path]` that forwards requests server-side — the browser never sees the real origin.

---

### 2. Stack traces visible to any org member — gate on role

**File:** `apps/web/app/console/[org]/projects/[slug]/project-detail.tsx` — `ErrorsTab` / `StackFrame`

Raw stack traces can contain internal file paths, env variable names embedded in error messages, and sometimes connection strings. The `ErrorDetail` pane renders them for all roles including `member`. Gate the full trace behind `owner`/`admin`:

```tsx
// In ErrorDetail, read membership role from session/context
{isAdmin ? <StackTrace frames={stackLines} /> : <RedactedStack />}
```

The role is already on `membership` in the layout — pass it down or read it from a context.

---

## P1 — Performance

### 3. Org overview makes 5 un-cached DB queries on every navigation

**File:** `apps/web/app/console/[org]/page.tsx`

Five `prisma.*` calls run via `Promise.all` on every request with no cache. Repeated dashboard visits pay the full Neon round-trip each time. Wrap the queries in `unstable_cache` (stable in Next 15 as `use cache`) tagged per org, revalidated when projects or events change:

```ts
import { unstable_cache } from "next/cache";

const getOrgStats = unstable_cache(
  async (orgId: string) => { /* the five queries */ },
  ["org-stats"],
  { revalidate: 60, tags: [`org-stats-${orgId}`] },
);
```

Call `revalidateTag(`org-stats-${orgId}`)` from any tRPC mutation that creates/deletes a project or ingests events.

---

### 4. `project-detail.tsx` ships ~2 400 lines to the client on every project page load

**File:** `apps/web/app/console/[org]/projects/[slug]/project-detail.tsx`

All 8 tabs are bundled together. The Sessions tab alone includes the canvas heatmap renderer, session replay, and rrweb frame logic — none of which is needed until the user clicks that tab. Split each tab into its own file and lazy-load:

```ts
const AnalyticsTab = dynamic(() => import("./tabs/analytics-tab"));
const SessionsTab  = dynamic(() => import("./tabs/sessions-tab"));
// ...
```

The 8-tab structure maps directly to 8 files. Each `dynamic()` import creates a separate chunk that only loads on demand.

---

### 5. Sessions table keeps all 50 rows mounted, including expanded replays

**File:** `apps/web/app/console/[org]/projects/[slug]/project-detail.tsx` — `SessionsTab`

Clicking a session row mounts `<SessionReplay>` inline. With 50 rows all in the DOM, memory and paint cost grows linearly. Use `@tanstack/react-virtual` to keep only ~15 rows mounted:

```ts
import { useVirtualizer } from "@tanstack/react-virtual";
```

`@tanstack/react-virtual` is a zero-dependency package that integrates directly with the existing TanStack Query setup.

---

## P2 — Architecture

### 6. Two data-fetching patterns in the same console — pick one

**Files:** `apps/web/app/console/[org]/page.tsx` (raw Prisma), `apps/web/app/console/[org]/projects/[slug]/page.tsx` (tRPC server prefetch)

The overview page queries Prisma directly in a server component; project pages use `queryClient.fetchQuery` with tRPC procedures. Both work, but mixing them splits auth checks, caching, and error handling across two layers. Document the convention explicitly in `AGENTS.md` — either:

- **Raw Prisma in server components** for read-only overview data (simpler, slightly faster), tRPC for all mutations and client-side queries.
- **tRPC everywhere** for a single place to add auth guards, input validation, and observability.

Whichever you choose, make it the stated rule so future pages follow it consistently.

---

### 7. Rust workspace lock file split

**Files:** `Cargo.toml` (root), `apps/ingest/Cargo.lock`

`apps/ingest` has its own `Cargo.lock` outside the workspace, so `cargo update` at the root silently leaves the ingest crate on stale dependency versions. Either add `apps/ingest` to the root `[workspace]` members array, or add a comment in `apps/ingest/Cargo.toml` explaining why it is intentionally isolated (e.g. deployed as a standalone binary with pinned deps).

---

## P3 — Developer Experience

### 8. No end-to-end tests for the core user journey

The signup → create org → create project → track event → view overview path has no automated coverage. A single Playwright test would catch regressions across the tRPC router, auth middleware, Prisma schema, and UI in one pass. Good starting point:

```ts
// e2e/onboarding.spec.ts
test("user can sign up, create a project, and see the overview", async ({ page }) => {
  await page.goto("/signup");
  // ...
});
```

Playwright is already in the ecosystem via `eslint-config-next`'s peer graph — add it as a dev dependency and a `test:e2e` script.

---

### 9. `NEXT_PUBLIC_CLARITY_API_KEY` and `NEXT_PUBLIC_CLARITY_PROJECT_ID` are not documented

**File:** `apps/web/.env` (and `.env.example` if it exists)

The self-dogfooding keys were hardcoded and are now in env vars, but neither `apps/web/.env` nor any README documents them. Add them to `.env` with placeholder values so the next developer knows they exist:

```env
# Self-dogfooding: Clarity tracks its own marketing page.
# Rotate via the Clarity console → API keys tab.
NEXT_PUBLIC_CLARITY_API_KEY=clr_live_…
NEXT_PUBLIC_CLARITY_PROJECT_ID=…
```

---

*All P0–P1 items require a decision or new dependency — none were auto-implemented because they affect security posture or bundle architecture.*
