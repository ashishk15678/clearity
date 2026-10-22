"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { SessionReplay } from "./session-replay";

type Tab = "overview" | "events" | "errors" | "sessions" | "pageviews" | "api-keys";

type ProjectWithCount = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  url: string | null;
  createdAt: Date;
  organizationId: string;
  organization?: { id: string; name: string; slug: string } | null;
  _count: {
    events: number;
    pageViews: number;
    apiKeys: number;
    sessionRecordings?: number;
  };
};

export function ProjectDetail({ project }: { project: ProjectWithCount }) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Project header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {project.name}
            </h2>
            <Badge variant="outline">{project.slug}</Badge>
          </div>
          {project.description && (
            <p className="mt-1 text-sm text-zinc-500">{project.description}</p>
          )}
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-xs text-indigo-500 hover:text-indigo-400"
            >
              {project.url}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
          active
        </div>
      </div>

      {/* Stat pills */}
      <div className="flex gap-3">
        {[
          { label: "Events", value: project._count.events },
          { label: "Page Views", value: project._count.pageViews },
          { label: "API Keys", value: project._count.apiKeys },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-center"
          >
            <p className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {s.value}
            </p>
            <p className="text-xs text-zinc-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex gap-6">
          {(["overview", "events", "errors", "sessions", "pageviews", "api-keys"] as Tab[]).map(
            (t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "border-b-2 pb-2 text-sm font-medium capitalize transition-colors",
                  tab === t
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
                )}
              >
                {t.replace("-", " ")}
              </button>
            ),
          )}
        </nav>
      </div>

      {/* Tab panels */}
      {tab === "overview" && <OverviewTab projectId={project.id} />}
      {tab === "events" && <EventsTab projectId={project.id} />}
      {tab === "errors" && <ErrorsTab projectId={project.id} />}
      {tab === "sessions" && <SessionsTab projectId={project.id} />}
      {tab === "pageviews" && <PageViewsTab projectId={project.id} />}
      {tab === "api-keys" && <ApiKeysTab projectId={project.id} />}
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const { data, isPending } = useQuery(
    trpc.reports.overview.queryOptions({ projectId, days: 7 }),
  );

  if (isPending) return <LoadingCards />;
  if (!data) return null;

  const pct = (n: number) =>
    n === 0 ? null : (
      <span className={n > 0 ? "text-emerald-500" : "text-red-500"}>
        {n > 0 ? "+" : ""}
        {n.toFixed(0)}%
      </span>
    );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-zinc-400 uppercase tracking-wider">
              Events (7d)
            </p>
            <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
              {data.events.toLocaleString()}
            </p>
            {pct(data.eventsChange) && (
              <p className="mt-1 text-xs">
                {pct(data.eventsChange)} vs prev period
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-zinc-400 uppercase tracking-wider">
              Page Views (7d)
            </p>
            <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
              {data.pageViews.toLocaleString()}
            </p>
            {pct(data.pageViewsChange) && (
              <p className="mt-1 text-xs">
                {pct(data.pageViewsChange)} vs prev period
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopTable
          title="Top Pages"
          rows={data.topPages.map((p) => ({ label: p.url, value: p.count }))}
          emptyMsg="No page views yet"
        />
        <TopTable
          title="Top Events"
          rows={data.topEvents.map((e) => ({ label: e.name, value: e.count }))}
          emptyMsg="No events yet"
        />
      </div>
    </div>
  );
}

function TopTable({
  title,
  rows,
  emptyMsg,
}: {
  title: string;
  rows: { label: string; value: number }[];
  emptyMsg: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </span>
      </CardHeader>
      {rows.length === 0 ? (
        <CardContent>
          <p className="text-sm text-zinc-400">{emptyMsg}</p>
        </CardContent>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 px-5 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs text-zinc-700 dark:text-zinc-300">
                  {r.label}
                </p>
                <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${(r.value / max) * 100}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-500">
                {r.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Events tab ──────────────────────────────────────────────────────────────

function EventsTab({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const { data, isPending } = useQuery(
    trpc.events.list.queryOptions({ projectId, limit: 50 }),
  );

  if (isPending) return <LoadingTable />;

  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Events
        </span>
      </CardHeader>
      {!data?.events.length ? (
        <CardContent>
          <IngestHint type="event" projectId={projectId} />
        </CardContent>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {["Name", "Type", "URL", "Time"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
              {data.events.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                >
                  <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {e.name}
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant="outline">{e.type}</Badge>
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-400 max-w-xs truncate">
                    {e.url ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── Errors tab ──────────────────────────────────────────────────────────────

function ErrorsTab({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<
    "unresolved" | "resolved" | "ignored" | "all"
  >("unresolved");

  const { data: groups, isPending } = useQuery(
    trpc.errors.list.queryOptions({
      projectId,
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: 50,
    }),
  );

  const updateStatus = useMutation(
    trpc.errors.updateStatus.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({
          queryKey: trpc.errors.list.queryKey({ projectId }),
        }),
    }),
  );

  if (isPending) return <LoadingTable />;

  const STATUS_COLORS: Record<string, string> = {
    unresolved:
      "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800",
    resolved:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800",
    ignored:
      "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700",
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {(["unresolved", "resolved", "ignored", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              statusFilter === s
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Error Groups
          </span>
        </CardHeader>
        {!groups?.length ? (
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">
                {statusFilter === "unresolved"
                  ? "No unresolved errors — nice work 🎉"
                  : "No errors in this category."}
              </p>
              <p className="text-xs text-zinc-500">
                Errors are captured automatically by the SDK when{" "}
                <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
                  window.onerror
                </code>{" "}
                or{" "}
                <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
                  unhandledrejection
                </code>{" "}
                fires on your page.
              </p>
            </div>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  {["Issue", "Type", "Occurrences", "Last seen", "Status", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {groups.map((g) => (
                  <tr
                    key={g.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  >
                    <td className="px-5 py-3 max-w-xs">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {g.message}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        First seen{" "}
                        {new Date(g.firstSeenAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <code className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                        {g.type}
                      </code>
                    </td>
                    <td className="px-5 py-3 tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                      {g.occurrences.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-400 whitespace-nowrap">
                      {new Date(g.lastSeenAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                          STATUS_COLORS[g.status] ?? "",
                        )}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {g.status !== "resolved" && (
                          <button
                            onClick={() =>
                              updateStatus.mutate({
                                id: g.id,
                                status: "resolved",
                              })
                            }
                            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap"
                          >
                            Resolve
                          </button>
                        )}
                        {g.status !== "ignored" && (
                          <button
                            onClick={() =>
                              updateStatus.mutate({
                                id: g.id,
                                status: "ignored",
                              })
                            }
                            className="text-xs text-zinc-400 hover:underline whitespace-nowrap"
                          >
                            Ignore
                          </button>
                        )}
                        {g.status !== "unresolved" && (
                          <button
                            onClick={() =>
                              updateStatus.mutate({
                                id: g.id,
                                status: "unresolved",
                              })
                            }
                            className="text-xs text-zinc-400 hover:underline whitespace-nowrap"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Sessions tab ─────────────────────────────────────────────────────────────

function SessionsTab({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: sessions, isPending } = useQuery(
    trpc.sessions.list.queryOptions({ projectId, limit: 50 }),
  );

  if (isPending) return <LoadingTable />;

  function fmtDuration(ms: number) {
    if (!ms) return "< 1s";
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  function fmtPath(url: string | null) {
    if (!url) return "—";
    try { return new URL(url).pathname; } catch { return url; }
  }

  return (
    <div className="space-y-4">
      {/* ── Session list ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Session Recordings
            </span>
            {selectedId && (
              <button
                onClick={() => setSelectedId(null)}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕ Close replay
              </button>
            )}
          </div>
        </CardHeader>
        {!sessions?.length ? (
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">No session recordings yet.</p>
              <p className="text-xs text-zinc-500">
                Sessions are automatically captured by the SDK and flushed every
                5 s and on page unload.
              </p>
            </div>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  {["Visitor","Start URL","Duration","Clicks","Errors","Started",""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedId === s.id
                        ? "bg-indigo-50 dark:bg-indigo-900/20"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30",
                    )}
                  >
                    <td className="px-5 py-3">
                      <code className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                        {s.visitorId.slice(0, 8)}…
                      </code>
                    </td>
                    <td className="px-5 py-3 max-w-[180px]">
                      <p className="truncate text-xs text-zinc-600 dark:text-zinc-300">
                        {fmtPath(s.startUrl)}
                      </p>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-xs text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                      {fmtDuration(s.duration)}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-xs text-zinc-600 dark:text-zinc-300">
                      {s.clickCount}
                      {s.rageClickCount > 0 && (
                        <span className="ml-1.5 text-[10px] text-orange-500">
                          {s.rageClickCount} rage
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {s.errorCount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-400">
                          {s.errorCount} error{s.errorCount !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-400 whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-indigo-500 hover:underline whitespace-nowrap">
                        {selectedId === s.id ? "▲ Hide" : "▶ Watch"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Inline replay panel ───────────────────────────────────────────── */}
      {selectedId && (
        <SessionReplayPanel sessionId={selectedId} />
      )}
    </div>
  );
}

// Lazy-loads the replay component so it doesn't pull canvas code into the bundle
// until actually needed.
function SessionReplayPanel({ sessionId }: { sessionId: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg">
      <SessionReplay sessionId={sessionId} />
    </div>
  );
}

// ─── Page views tab ───────────────────────────────────────────────────────────

function PageViewsTab({ projectId }: { projectId: string }) {
  // Reuse summary from reports router
  const trpc = useTRPC();
  const { data, isPending } = useQuery(
    trpc.reports.overview.queryOptions({ projectId, days: 30 }),
  );

  if (isPending) return <LoadingTable />;

  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Top Pages (last 30 days)
        </span>
      </CardHeader>
      {!data?.topPages.length ? (
        <CardContent>
          <IngestHint type="pageview" projectId={projectId} />
        </CardContent>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {["URL", "Views"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
              {data.topPages.map((p) => (
                <tr
                  key={p.url}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                >
                  <td className="px-5 py-3 text-zinc-700 dark:text-zinc-300">
                    {p.url}
                  </td>
                  <td className="px-5 py-3 tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                    {p.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── API Keys tab ─────────────────────────────────────────────────────────────

function ApiKeysTab({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: keys, isPending } = useQuery(
    trpc.projects.listApiKeys.queryOptions({ projectId }),
  );

  const create = useMutation(
    trpc.projects.createApiKey.mutationOptions({
      onSuccess: (data) => {
        qc.invalidateQueries({
          queryKey: trpc.projects.listApiKeys.queryKey({ projectId }),
        });
        setNewKey(data.key);
        setOpen(false);
      },
    }),
  );

  const revoke = useMutation(
    trpc.projects.revokeApiKey.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: trpc.projects.listApiKeys.queryKey({ projectId }),
        });
      },
    }),
  );

  return (
    <div className="space-y-4">
      {/* New key banner */}
      {newKey && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
            Your new API key — copy it now, it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-mono text-zinc-800 dark:text-zinc-200 break-all">
              {newKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newKey);
              }}
              className="shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            I&apos;ve saved it
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              API Keys
            </span>
            <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
              New Key
            </Button>
          </div>
        </CardHeader>

        {isPending ? (
          <LoadingTable />
        ) : !keys?.length ? (
          <CardContent>
            <p className="text-sm text-zinc-400">
              No API keys yet. Create one to start sending data.
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  {["Name", "Prefix", "Last Used", "Created", ""].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {keys.map((k) => (
                  <tr
                    key={k.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  >
                    <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {k.name}
                    </td>
                    <td className="px-5 py-3">
                      <code className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                        {k.prefix}••••••••
                      </code>
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-400">
                      {k.lastUsedAt
                        ? new Date(k.lastUsedAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-400">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => revoke.mutate({ id: k.id })}
                        className="text-xs text-red-500 hover:text-red-400 hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create key dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New API Key</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              create.mutate({ projectId, name: fd.get("name") as string });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="keyname">Name</Label>
              <Input
                id="keyname"
                name="name"
                required
                placeholder="Production"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={create.isPending}
              >
                {create.isPending ? "Creating…" : "Create Key"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function IngestHint({
  type,
  projectId,
}: {
  type: "event" | "pageview";
  projectId: string;
}) {
  const endpoint = type === "event" ? "/track/event" : "/track/pageview";
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        No data yet. Send data to the Ingest service:
      </p>
      <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-300 font-mono leading-relaxed">
        {`curl -X POST http://localhost:4000${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: <your-api-key>" \\
  -d '{"project_id":"${projectId}","name":"${type === "event" ? "button_click" : "page_load"}","url":"/"}'`}
      </pre>
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="grid grid-cols-2 gap-4 animate-pulse">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5"
        >
          <div className="h-3 w-1/3 rounded bg-zinc-100 dark:bg-zinc-800 mb-3" />
          <div className="h-8 w-1/2 rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

function LoadingTable() {
  return (
    <div className="space-y-2 p-5 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-8 rounded bg-zinc-100 dark:bg-zinc-800" />
      ))}
    </div>
  );
}
