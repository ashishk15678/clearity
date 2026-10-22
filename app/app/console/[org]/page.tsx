import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

  // Find the active org for this user
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      organization: { slug: orgSlug },
    },
    include: { organization: true },
  });

  if (!membership) notFound();
  const org = membership.organization;

  // Fetch stats for this org
  const [projects, totalEvents, totalPageViews, totalErrors, sessions] =
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

  const stats = [
    {
      label: "Projects",
      value: projects.length.toString(),
      sub: "in this org",
    },
    { label: "Events", value: totalEvents.toLocaleString(), sub: "all time" },
    {
      label: "Page Views",
      value: totalPageViews.toLocaleString(),
      sub: "all time",
    },
    {
      label: "Open Errors",
      value: totalErrors.toLocaleString(),
      sub: "unresolved",
      accent: totalErrors > 0,
    },
    { label: "Sessions", value: sessions.toLocaleString(), sub: "recorded" },
  ];

  return (
    <div className="flex flex-col">
      <Topbar title="Overview" />
      <div className="flex-1 p-6 space-y-6 max-w-6xl">
        {/* Org header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                {org.name}
              </h2>
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {membership.role}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Good to see you, {session.user.name} 👋
            </p>
          </div>
          <Link
            href={`/console/${orgSlug}/teams`}
            className="text-xs text-primary hover:underline"
          >
            Manage team →
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl bg-card shadow-sm p-4 flex flex-col gap-1"
            >
              <p className="text-xs text-muted-foreground font-medium">
                {s.label}
              </p>
              <p
                className={`text-2xl font-bold tabular-nums ${s.accent ? "text-destructive" : "text-foreground"}`}
              >
                {s.value}
              </p>
              <p className="text-[11px] text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Recent projects */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Recent Projects
              </h3>
              <Link
                href={`/console/${orgSlug}/projects`}
                className="text-xs text-primary hover:underline"
              >
                View all
              </Link>
            </div>

            {projects.length === 0 ? (
              <div className="rounded-xl bg-card shadow-sm flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <svg
                    className="h-5 w-5 text-muted-foreground"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground">
                  No projects yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create one to start tracking.
                </p>
                <Link
                  href={`/console/${orgSlug}/projects`}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  New Project
                </Link>
              </div>
            ) : (
              <div className="rounded-xl bg-card shadow-sm divide-y divide-border overflow-hidden">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/console/${orgSlug}/projects/${p.slug}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.slug}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0 ml-4">
                      <span>{p._count.events.toLocaleString()} events</span>
                      <span>{p._count.pageViews.toLocaleString()} views</span>
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick start */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Quick Start
            </h3>
            <div className="rounded-xl bg-card shadow-sm p-4 space-y-2">
              <Step
                n={1}
                done={projects.length > 0}
                label="Create a project"
                href={`/console/${orgSlug}/projects`}
              />
              <Step
                n={2}
                done={false}
                label="Generate an API key"
                href={`/console/${orgSlug}/projects`}
              />
              <Step
                n={3}
                done={false}
                label="Install the SDK"
                href={`/console/${orgSlug}/settings`}
              />
              <Step
                n={4}
                done={false}
                label="Invite your team"
                href={`/console/${orgSlug}/teams`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({
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
      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          done
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span
        className={`text-sm ${done ? "line-through text-muted-foreground" : "text-foreground"}`}
      >
        {label}
      </span>
    </Link>
  );
}
