import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Topbar } from "@/components/dashboard/topbar";
import { trpc, getQueryClient } from "@/trpc/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const metadata = { title: "Overview · Clarity" };

export default async function ConsolePage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: orgSlug } = await params;
  const session = await auth
  .api.getSession({ headers: await headers() });
  if (!session) return null;
  const qc = getQueryClient();

  await Promise.all([
    qc.prefetchQuery(trpc.org.membership.queryOptions({ orgSlug })),
    qc.prefetchQuery(trpc.org.orgOverview.queryOptions({ orgSlug })),
  ]);

  return (
    <div className="flex flex-col min-h-0">
      <Topbar title="Overview" />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-5 sm:px-8 py-8 space-y-8">

          {/* Header: org name + role + welcome — instant from prefetch cache */}
          <Suspense fallback={<HeaderSkeleton />}>
            <OrgHeader orgSlug={orgSlug} />
          </Suspense>

          {/* Stat strip — streams in as soon as the 5 counts resolve */}
          <Suspense fallback={<StatsSkeleton />}>
            <OrgStats orgSlug={orgSlug} />
          </Suspense>

          {/* Recent projects list — streams in independently */}
          <Suspense fallback={<ProjectsSkeleton />}>
            <RecentProjects orgSlug={orgSlug} />
          </Suspense>

        </div>
      </div>
    </div>
  );
}

async function OrgHeader({ orgSlug }: { orgSlug: string }) {
  const qc = getQueryClient();
  const membership = await qc.fetchQuery(
    trpc.org.membership.queryOptions({ orgSlug }),
  );
  if (!membership) notFound();

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-semibold text-foreground">
            {membership.organization.name}
          </h2>
          <RoleBadge role={membership.role} />
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Org slug:{" "}
          <span className="font-mono text-foreground">{orgSlug}</span>
        </p>
      </div>
      <Link
        href={`/console/${orgSlug}/teams`}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
      >
        Manage team
        <svg
          className="h-3 w-3 text-muted-foreground"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </Link>
    </div>
  );
}

// ─── OrgStats ─────────────────────────────────────────────────────────────────
// Reads from the orgOverview prefetch — same QueryClient, zero extra DB call.

async function OrgStats({ orgSlug }: { orgSlug: string }) {
  const qc = getQueryClient();
  const data = await qc.fetchQuery(
    trpc.org.orgOverview.queryOptions({ orgSlug }),
  );

  const stats: { label: string; value: string; sub: string; href: string; warn?: boolean }[] = [
    {
      label: "Projects",
      value: data.projects.length.toString(),
      sub: "total",
      href: `/console/${orgSlug}/projects`,
    },
    {
      label: "Events",
      value: data.totalEvents.toLocaleString(),
      sub: "all time",
      href: `/console/${orgSlug}/reports`,
    },
    {
      label: "Page Views",
      value: data.totalPageViews.toLocaleString(),
      sub: "all time",
      href: `/console/${orgSlug}/reports`,
    },
    {
      label: "Sessions",
      value: data.totalSessions.toLocaleString(),
      sub: "recorded",
      href: `/console/${orgSlug}/projects`,
    },
    {
      label: "Open Errors",
      value: data.totalErrors.toLocaleString(),
      sub: "unresolved",
      href: `/console/${orgSlug}/projects`,
      warn: data.totalErrors > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <Link
          key={s.label}
          href={s.href}
          className="group relative flex flex-col gap-1.5 rounded-lg border border-border bg-card px-4 py-3.5 hover:border-border/80 hover:bg-muted/30 transition-all"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {s.label}
          </p>
          <p
            className={`text-[22px] font-bold tabular-nums leading-none tracking-tight ${
              s.warn ? "text-destructive" : "text-foreground"
            }`}
          >
            {s.value}
          </p>
          <p className="text-[11px] text-muted-foreground/60">{s.sub}</p>
          {s.warn && (
            <span className="absolute top-3 right-3 h-1.5 w-1.5 rounded-full bg-destructive" />
          )}
        </Link>
      ))}
    </div>
  );
}

// ─── RecentProjects ───────────────────────────────────────────────────────────
// Same orgOverview fetch — deduplicated by QueryClient cache, no extra query.

async function RecentProjects({ orgSlug }: { orgSlug: string }) {
  const qc = getQueryClient();
  const data = await qc.fetchQuery(
    trpc.org.orgOverview.queryOptions({ orgSlug }),
  );
  const projects = data.projects;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-foreground">
          Recent projects
        </h3>
        <Link
          href={`/console/${orgSlug}/projects`}
          className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          View all →
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyProjects orgSlug={orgSlug} />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          {projects.map((p, i) => (
            <Link
              key={p.id}
              href={`/console/${orgSlug}/projects/${p.slug}`}
              className={`flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 transition-colors group ${
                i < projects.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-7 w-7 shrink-0 rounded-md bg-muted border border-border flex items-center justify-center text-[11px] font-semibold text-muted-foreground uppercase">
                  {p.name[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">
                    {p.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono leading-none mt-0.5">
                    {p.slug}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 ml-4">
                <StatPill label="events" value={p._count.events} />
                <StatPill label="views" value={p._count.pageViews} />
                <svg
                  className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
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
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-4 w-14 rounded bg-muted" />
        </div>
        <div className="h-3 w-48 rounded bg-muted" />
      </div>
      <div className="h-8 w-28 rounded-md bg-muted" />
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-card px-4 py-3.5 space-y-2"
        >
          <div className="h-2.5 w-14 rounded bg-muted" />
          <div className="h-6 w-10 rounded bg-muted" />
          <div className="h-2 w-8 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-28 rounded bg-muted" />
        <div className="h-3 w-14 rounded bg-muted" />
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between px-4 py-3 border-b last:border-0 border-border bg-card"
          >
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-muted" />
              <div className="space-y-1.5">
                <div className="h-3 w-28 rounded bg-muted" />
                <div className="h-2.5 w-20 rounded bg-muted" />
              </div>
            </div>
            <div className="hidden sm:flex gap-6">
              <div className="space-y-1 items-end flex flex-col">
                <div className="h-3 w-10 rounded bg-muted" />
                <div className="h-2.5 w-8 rounded bg-muted" />
              </div>
              <div className="space-y-1 items-end flex flex-col">
                <div className="h-3 w-10 rounded bg-muted" />
                <div className="h-2.5 w-8 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
      {role}
    </span>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="hidden sm:flex flex-col items-end">
      <span className="text-[12px] font-semibold tabular-nums text-foreground leading-none">
        {value.toLocaleString()}
      </span>
      <span className="text-[10px] text-muted-foreground/50 mt-0.5 leading-none">
        {label}
      </span>
    </div>
  );
}

function EmptyProjects({ orgSlug }: { orgSlug: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted">
        <svg
          className="h-4 w-4 text-muted-foreground"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      </div>
      <p className="text-[13px] font-semibold text-foreground">
        No projects yet
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Create your first project to start tracking.
      </p>
      <Link
        href={`/console/${orgSlug}/projects`}
        className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-1.5 text-[12px] font-medium text-background hover:opacity-90 transition-opacity"
      >
        New project
      </Link>
    </div>
  );
}
