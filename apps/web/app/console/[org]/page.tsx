import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Topbar } from "@/components/dashboard/topbar";
import { trpc, getQueryClient } from "@/trpc/server";

export const metadata = { title: "Overview · Clarity" };

export default async function ConsolePage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: orgSlug } = await params;
  const qc = getQueryClient();

  await Promise.all([
    qc.prefetchQuery(trpc.org.membership.queryOptions({ orgSlug })),
    qc.prefetchQuery(trpc.org.orgOverview.queryOptions({ orgSlug })),
  ]);

  return (
    <div className="flex flex-col min-h-0">
      <Topbar title="Overview" />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8 space-y-10">

          <Suspense fallback={<HeaderSkeleton />}>
            <OrgHeader orgSlug={orgSlug} />
          </Suspense>

          <Suspense fallback={<StatsSkeleton />}>
            <OrgStats orgSlug={orgSlug} />
          </Suspense>

          <Suspense fallback={<ProjectsSkeleton />}>
            <RecentProjects orgSlug={orgSlug} />
          </Suspense>

        </div>
      </div>
    </div>
  );
}

// ─── OrgHeader ────────────────────────────────────────────────────────────────

async function OrgHeader({ orgSlug }: { orgSlug: string }) {
  const qc = getQueryClient();
  const membership = await qc.fetchQuery(
    trpc.org.membership.queryOptions({ orgSlug }),
  );
  if (!membership) notFound();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {membership.organization.name}
          </h2>
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
            {membership.role.toLowerCase()}
          </span>
        </div>
        <p className="text-[13px] text-muted-foreground">
          Workspace overview — all projects, events, and errors at a glance.
        </p>
      </div>
      <Link
        href={`/console/${orgSlug}/teams`}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-[12px] font-medium text-foreground hover:bg-muted hover:border-primary/30 transition-all"
      >
        Manage team
        <svg className="h-3 w-3 text-muted-foreground" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" clipRule="evenodd" />
        </svg>
      </Link>
    </div>
  );
}

// ─── OrgStats ─────────────────────────────────────────────────────────────────

async function OrgStats({ orgSlug }: { orgSlug: string }) {
  const qc = getQueryClient();
  const data = await qc.fetchQuery(
    trpc.org.orgOverview.queryOptions({ orgSlug }),
  );

  const stats = [
    {
      label: "Projects",
      value: data.projects.length,
      sub: "total",
      href: `/console/${orgSlug}/projects`,
      fmt: (n: number) => n.toString(),
    },
    {
      label: "Events",
      value: data.totalEvents,
      sub: "all time",
      href: `/console/${orgSlug}/reports`,
      fmt: (n: number) => fmtCompact(n),
    },
    {
      label: "Page Views",
      value: data.totalPageViews,
      sub: "all time",
      href: `/console/${orgSlug}/reports`,
      fmt: (n: number) => fmtCompact(n),
    },
    {
      label: "Sessions",
      value: data.totalSessions,
      sub: "recorded",
      href: `/console/${orgSlug}/projects`,
      fmt: (n: number) => fmtCompact(n),
    },
    {
      label: "Open Errors",
      value: data.totalErrors,
      sub: "unresolved",
      href: `/console/${orgSlug}/projects`,
      fmt: (n: number) => n.toLocaleString(),
      warn: data.totalErrors > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <Link
          key={s.label}
          href={s.href}
          className="group relative flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-[0_0_0_1px_rgba(124,58,237,0.15)] hover:bg-card/80"
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {s.label}
          </span>
          <span
            className={`text-2xl font-bold tabular-nums leading-none ${
              s.warn ? "text-destructive" : "text-foreground"
            }`}
          >
            {s.fmt(s.value)}
          </span>
          <span className="text-[11px] text-muted-foreground/60">{s.sub}</span>
          {s.warn && (
            <span className="absolute top-3 right-3 h-1.5 w-1.5 rounded-full bg-destructive" />
          )}
        </Link>
      ))}
    </div>
  );
}

// ─── RecentProjects ───────────────────────────────────────────────────────────

async function RecentProjects({ orgSlug }: { orgSlug: string }) {
  const qc = getQueryClient();
  const data = await qc.fetchQuery(
    trpc.org.orgOverview.queryOptions({ orgSlug }),
  );
  const projects = data.projects;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">
            Recent projects
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {projects.length} project{projects.length !== 1 ? "s" : ""} in this workspace
          </p>
        </div>
        <Link
          href={`/console/${orgSlug}/projects`}
          className="inline-flex items-center gap-1 text-[12px] text-primary hover:text-primary/80 transition-colors font-medium"
        >
          View all
          <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>

      {/* Table */}
      {projects.length === 0 ? (
        <EmptyProjects orgSlug={orgSlug} />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_80px_32px] items-center gap-4 px-4 py-2.5 bg-muted/40 border-b border-border">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Project</span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-right hidden sm:block">Events</span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-right hidden sm:block">Views</span>
            <span />
          </div>

          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/console/${orgSlug}/projects/${p.slug}`}
              className="grid grid-cols-[1fr_80px_80px_32px] items-center gap-4 px-4 py-3 border-b border-border last:border-0 bg-card hover:bg-muted/30 transition-colors group"
            >
              {/* Name + slug */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-7 w-7 shrink-0 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary uppercase">
                  {p.name[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">
                    {p.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono leading-none mt-0.5 truncate">
                    {p.slug}
                  </p>
                </div>
              </div>

              {/* Event count */}
              <span className="hidden sm:block text-[13px] tabular-nums text-foreground text-right font-medium">
                {fmtCompact(p._count.events)}
              </span>

              {/* Page view count */}
              <span className="hidden sm:block text-[13px] tabular-nums text-foreground text-right font-medium">
                {fmtCompact(p._count.pageViews)}
              </span>

              {/* Arrow */}
              <svg
                className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors justify-self-end"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" clipRule="evenodd" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4 animate-pulse">
      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-36 rounded bg-muted" />
          <div className="h-5 w-14 rounded-full bg-muted" />
        </div>
        <div className="h-3 w-56 rounded bg-muted" />
      </div>
      <div className="h-9 w-28 rounded-lg bg-muted" />
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="h-2.5 w-16 rounded bg-muted" />
          <div className="h-7 w-12 rounded bg-muted" />
          <div className="h-2 w-10 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-3.5 w-28 rounded bg-muted" />
          <div className="h-2.5 w-20 rounded bg-muted" />
        </div>
        <div className="h-3 w-14 rounded bg-muted" />
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="h-9 bg-muted/40 border-b border-border" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_80px_32px] items-center gap-4 px-4 py-3 border-b last:border-0 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-muted" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3 w-28 rounded bg-muted" />
                <div className="h-2.5 w-20 rounded bg-muted" />
              </div>
            </div>
            <div className="hidden sm:block h-3 w-10 rounded bg-muted ml-auto" />
            <div className="hidden sm:block h-3 w-10 rounded bg-muted ml-auto" />
            <div className="h-4 w-4 rounded bg-muted justify-self-end" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function EmptyProjects({ orgSlug }: { orgSlug: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
        <svg className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      </div>
      <div>
        <p className="text-[14px] font-semibold text-foreground">No projects yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Create your first project to start tracking.
        </p>
      </div>
      <Link
        href={`/console/${orgSlug}/projects`}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary/90 transition-colors"
      >
        New project
      </Link>
    </div>
  );
}

/** Compact number formatter — 12 400 → 12.4K, 1 200 000 → 1.2M */
function fmtCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}
