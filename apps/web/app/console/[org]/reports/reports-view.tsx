"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function ReportsView({ organizationId }: { organizationId: string }) {
  const trpc = useTRPC();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [days, setDays] = useState(14);

  const { data: projects } = useQuery(
    trpc.projects.list.queryOptions({ organizationId }),
  );

  const projectId = selectedProjectId ?? projects?.[0]?.id ?? "";

  const { data: overview } = useQuery({
    ...trpc.reports.overview.queryOptions({ projectId, days }),
    enabled: !!projectId,
  });

  const { data: eventSeries } = useQuery({
    ...trpc.events.timeSeries.queryOptions({ projectId, days }),
    enabled: !!projectId,
  });

  const { data: pvSeries } = useQuery({
    ...trpc.reports.pageViewTimeSeries.queryOptions({ projectId, days }),
    enabled: !!projectId,
  });

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={projectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {!projects?.length && <option value="">— No projects —</option>}
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 14, 30, 90].map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        </div>
      </div>

      {!projectId ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-sm text-zinc-400">
            Create a project first to view reports.
          </p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPICard
              label="Events"
              value={overview?.events}
              change={overview?.eventsChange}
            />
            <KPICard
              label="Page Views"
              value={overview?.pageViews}
              change={overview?.pageViewsChange}
            />
            <KPICard
              label="Top Page"
              value={overview?.topPages[0]?.url ?? "—"}
            />
            <KPICard
              label="Top Event"
              value={overview?.topEvents[0]?.name ?? "—"}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <BarChart
              title={`Events per day (${days}d)`}
              data={eventSeries ?? []}
              color="#6366f1"
            />
            <BarChart
              title={`Page views per day (${days}d)`}
              data={pvSeries ?? []}
              color="#10b981"
            />
          </div>

          {/* Top tables */}
          <div className="grid gap-4 lg:grid-cols-2">
            <TopList
              title="Top Events"
              rows={
                overview?.topEvents.map((e) => ({
                  label: e.name,
                  value: e.count,
                })) ?? []
              }
              color="#6366f1"
            />
            <TopList
              title="Top Pages"
              rows={
                overview?.topPages.map((p) => ({
                  label: p.url,
                  value: p.count,
                })) ?? []
              }
              color="#10b981"
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  change,
}: {
  label: string;
  value?: number | string;
  change?: number;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          {label}
        </p>
        <p className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50 truncate">
          {value === undefined ? (
            <span className="inline-block h-7 w-16 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ) : typeof value === "number" ? (
            value.toLocaleString()
          ) : (
            value
          )}
        </p>
        {change !== undefined && change !== 0 && (
          <p
            className={`mt-0.5 text-xs ${change > 0 ? "text-emerald-500" : "text-red-500"}`}
          >
            {change > 0 ? "+" : ""}
            {change.toFixed(0)}% vs prev period
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Bar Chart (CSS-only, no dep) ─────────────────────────────────────────────

function BarChart({
  title,
  data,
  color,
}: {
  title: string;
  data: { date: string; count: number }[];
  color: string;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </span>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-zinc-400 py-8 text-center">No data</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {data.map((d) => (
              <div
                key={d.date}
                className="group flex-1 flex flex-col items-center justify-end gap-1"
              >
                <div
                  className="relative w-full rounded-sm transition-all hover:opacity-80"
                  style={{
                    height: `${Math.max((d.count / max) * 100, d.count > 0 ? 4 : 2)}%`,
                    backgroundColor: d.count > 0 ? color : "#e4e4e7",
                  }}
                  title={`${d.date}: ${d.count}`}
                />
                {/* x-axis label every ~4 */}
                {data.indexOf(d) % Math.ceil(data.length / 7) === 0 && (
                  <span className="text-[10px] text-zinc-400 rotate-45 origin-left whitespace-nowrap">
                    {d.date.slice(5)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Top list ─────────────────────────────────────────────────────────────────

function TopList({
  title,
  rows,
  color,
}: {
  title: string;
  rows: { label: string; value: number }[];
  color: string;
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
          <p className="text-sm text-zinc-400">No data yet</p>
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
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(r.value / max) * 100}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-500">
                {r.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
