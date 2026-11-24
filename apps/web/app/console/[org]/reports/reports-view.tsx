"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function ReportsView({ organizationId }: { organizationId: string }) {
  const trpc = useTRPC();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
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

  const selectCls =
    "h-9 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all cursor-pointer";

  return (
    <div className="flex-1 p-6 max-w-5xl space-y-8">

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label htmlFor="report-project" className="sr-only">Project</label>
          <select
            id="report-project"
            className={selectCls}
            value={projectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {!projects?.length && <option value="">— No projects —</option>}
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="report-days" className="sr-only">Time range</label>
          <select
            id="report-days"
            className={selectCls}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 14, 30, 90].map((d) => (
              <option key={d} value={d}>Last {d} days</option>
            ))}
          </select>
        </div>
      </div>

      {!projectId ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-dashed border-border">
          <div className="mb-3 h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <svg className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <p className="text-[14px] font-semibold text-foreground">No data yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Create a project first to view reports.</p>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KPICard label="Events" value={overview?.events} change={overview?.eventsChange} />
            <KPICard label="Page Views" value={overview?.pageViews} change={overview?.pageViewsChange} />
            <KPICard label="Top Page" value={overview?.topPages[0]?.url ?? "—"} />
            <KPICard label="Top Event" value={overview?.topEvents[0]?.name ?? "—"} />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <BarChart title={`Events — last ${days}d`} data={eventSeries ?? []} color="var(--color-primary)" />
            <BarChart title={`Page views — last ${days}d`} data={pvSeries ?? []} color="#2563eb" />
          </div>

          {/* Top lists */}
          <div className="grid gap-4 lg:grid-cols-2">
            <TopList title="Top events" rows={overview?.topEvents.map((e) => ({ label: e.name, value: e.count })) ?? []} color="var(--color-primary)" />
            <TopList title="Top pages" rows={overview?.topPages.map((p) => ({ label: p.url, value: p.count })) ?? []} color="#2563eb" />
          </div>
        </>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, change }: {
  label: string;
  value?: number | string;
  change?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums text-foreground leading-none truncate">
        {value === undefined ? (
          <span className="inline-block h-7 w-16 rounded-md bg-muted animate-pulse" />
        ) : typeof value === "number" ? (
          value.toLocaleString()
        ) : (
          value
        )}
      </p>
      {change !== undefined && change !== 0 && (
        <p className={`text-[11px] font-medium flex items-center gap-1 ${change > 0 ? "text-emerald-500" : "text-destructive"}`}>
          <span>{change > 0 ? "↑" : "↓"}{Math.abs(change).toFixed(0)}%</span>
          <span className="text-muted-foreground font-normal">vs prev period</span>
        </p>
      )}
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

function BarChart({ title, data, color }: {
  title: string;
  data: { date: string; count: number }[];
  color: string;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[13px] font-semibold text-foreground mb-4">{title}</p>
      {data.length === 0 ? (
        <p className="text-[13px] text-muted-foreground py-6 text-center">No data</p>
      ) : (
        <div className="flex items-end gap-0.5 h-28">
          {data.map((d, i) => (
            <div key={d.date} className="group flex-1 flex flex-col items-center justify-end gap-1">
              <div
                className="relative w-full rounded-sm transition-all group-hover:opacity-70"
                style={{
                  height: `${Math.max((d.count / max) * 100, d.count > 0 ? 6 : 2)}%`,
                  backgroundColor: d.count > 0 ? color : "var(--color-border)",
                  opacity: d.count > 0 ? 0.85 : 0.3,
                }}
                title={`${d.date}: ${d.count}`}
              />
              {i % Math.ceil(data.length / 7) === 0 && (
                <span className="text-[9px] text-muted-foreground/50 whitespace-nowrap">
                  {d.date.slice(5)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Top List ─────────────────────────────────────────────────────────────────

function TopList({ title, rows, color }: {
  title: string;
  rows: { label: string; value: number }[];
  color: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground px-4 py-6">No data yet</p>
      ) : (
        <div>
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <div className="flex-1 min-w-0 space-y-1">
                <p className="truncate text-[12px] text-foreground font-medium">{r.label}</p>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(r.value / max) * 100}%`, backgroundColor: color, opacity: 0.7 }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-muted-foreground">
                {r.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
