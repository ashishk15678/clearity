import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/dashboard/topbar";
import Link from "next/link";

export const metadata = { title: "Overview · Clarity" };

export default async function ConsolePage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: orgSlug } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organization: { slug: orgSlug } },
    include: { organization: true },
  });
  if (!membership) notFound();
  const org = membership.organization;

  const [projects, totalEvents, totalPageViews, totalErrors, totalSessions] =
    await Promise.all([
      prisma.project.findMany({
        where: { organizationId: org.id },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: { _count: { select: { events: true, pageViews: true } } },
      }),
      prisma.event.count({ where: { project: { organizationId: org.id } } }),
      prisma.pageView.count({ where: { project: { organizationId: org.id } } }),
      prisma.errorGroup.count({
        where: { project: { organizationId: org.id }, status: "unresolved" },
      }),
      prisma.sessionRecording.count({
        where: { project: { organizationId: org.id } },
      }),
    ]);

  const stats: {
    label: string;
    value: string;
    sub: string;
    href: string;
    accent?: boolean;
  }[] = [
    {
      label: "Projects",
      value: projects.length.toString(),
      sub: "total",
      href: `/console/${orgSlug}/projects`,
    },
    {
      label: "Events",
      value: totalEvents.toLocaleString(),
      sub: "all time",
      href: `/console/${orgSlug}/projects`,
    },
    {
      label: "Page Views",
      value: totalPageViews.toLocaleString(),
      sub: "all time",
      href: `/console/${orgSlug}/projects`,
    },
    {
      label: "Sessions",
      value: totalSessions.toLocaleString(),
      sub: "recorded",
      href: `/console/${orgSlug}/projects`,
    },
    {
      label: "Open Errors",
      value: totalErrors.toLocaleString(),
      sub: "unresolved",
      href: `/console/${orgSlug}/projects`,
      accent: totalErrors > 0,
    },
  ];

  return (
    <div className="flex flex-col min-h-0">
      <Topbar title="Overview" />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-8">
          {/* ── Org header ──────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  {org.name}
                </h2>
                <RoleBadge role={membership.role} />
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Welcome back, {session.user.name ?? session.user.email} 👋
              </p>
            </div>
            <Link
              href={`/console/${orgSlug}/teams`}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              Manage team
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          </div>

          {/* ── Stat grid ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="group flex flex-col gap-1 rounded-lg border border-border bg-card p-4 hover:border-foreground/20 transition-colors"
              >
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </p>
                <p
                  className={`text-2xl font-bold tabular-nums leading-none ${s.accent ? "text-destructive" : "text-foreground"}`}
                >
                  {s.value}
                </p>
                <p className="text-xs text-muted-foreground">{s.sub}</p>
              </Link>
            ))}
          </div>

          {/* ── Bottom section ───────────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent projects */}
            <div className="lg:col-span-2 space-y-3">
              <SectionHeader
                title="Recent Projects"
                action={{
                  label: "View all",
                  href: `/console/${orgSlug}/projects`,
                }}
              />

              {projects.length === 0 ? (
                <EmptyProjects orgSlug={orgSlug} />
              ) : (
                <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                  {projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/console/${orgSlug}/projects/${p.slug}`}
                      className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/50 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {p.name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {p.slug}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 ml-4">
                        <span className="hidden sm:block tabular-nums">
                          {p._count.events.toLocaleString()} events
                        </span>
                        <span className="hidden sm:block tabular-nums">
                          {p._count.pageViews.toLocaleString()} views
                        </span>
                        <svg
                          className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors"
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
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
      {role}
    </span>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      {action && (
        <Link
          href={action.href}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}

function EmptyProjects({ orgSlug }: { orgSlug: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card flex flex-col items-center justify-center py-12 text-center w-full">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-border">
        <svg
          className="h-4 w-4 text-muted-foreground"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-foreground">No projects yet</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Create one to start tracking.
      </p>
      <Link
        href={`/console/${orgSlug}/projects`}
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 transition-opacity"
      >
        New project
      </Link>
    </div>
  );
}

function CheckStep({
  n,
  done,
  label,
  href,
}: {
  n: number;
  done: boolean;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/50 transition-colors"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
          done
            ? "bg-foreground text-background"
            : "border border-border text-muted-foreground"
        }`}
      >
        {done ? (
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M10.28 1.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-8a1 1 0 00-1.414-1.414z" />
          </svg>
        ) : (
          n
        )}
      </span>
      <span
        className={`text-sm ${done ? "line-through text-muted-foreground" : "text-foreground"}`}
      >
        {label}
      </span>
    </Link>
  );
}
