"use client";

import { useState, useRef, useCallback } from "react";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
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

type Tab =
  | "overview"
  | "analytics"
  | "events"
  | "errors"
  | "sessions"
  | "pageviews"
  | "api-keys"
  | "setup";

type ProjectWithCount = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  url: string | null;
  createdAt: Date | string; // tRPC serialises Date → string over the wire
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "analytics", label: "Analytics" },
    { id: "events", label: "Events" },
    { id: "errors", label: "Errors" },
    { id: "sessions", label: "Sessions" },
    { id: "pageviews", label: "Page views" },
    { id: "api-keys", label: "API keys" },
    { id: "setup", label: "Setup" },
  ];

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
      <div className="bg-background px-5 sm:px-6 pt-5 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">
              {project.name}
            </h2>
            {project.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 text-xs text-primary hover:underline block truncate"
              >
                {project.url}
              </a>
            )}
          </div>
          {/* Stat pills */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {[
              { label: "Events", value: project._count.events },
              { label: "Views", value: project._count.pageViews },
              { label: "API keys", value: project._count.apiKeys },
            ].map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center rounded-md border border-border px-3 py-1.5 min-w-14"
              >
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {s.value}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-xs px-5 sm:px-6">
        <div role="tablist" aria-label="Project sections" className="flex gap-0 overflow-x-auto -mb-px">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`tabpanel-${t.id}`}
              id={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === t.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab panels ──────────────────────────────────────────────── */}
      <div className="flex-1">
        <div
          role="tabpanel"
          id={`tabpanel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          className="px-5 sm:px-6 py-6"
        >
          {tab === "overview" && <OverviewTab projectId={project.id} />}
          {tab === "analytics" && <AnalyticsTab projectId={project.id} />}
          {tab === "events" && <EventsTab projectId={project.id} />}
          {tab === "errors" && <ErrorsTab projectId={project.id} />}
          {tab === "sessions" && <SessionsTab projectId={project.id} />}
          {tab === "pageviews" && <PageViewsTab projectId={project.id} />}
          {tab === "api-keys" && <ApiKeysTab projectId={project.id} />}
          {tab === "setup" && <SetupTab projectId={project.id} />}
        </div>
      </div>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[13px] font-semibold text-foreground mb-4">
      {children}
    </h3>
  );
}

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      {children}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground max-w-xs">{desc}</p>
      </div>
      {action}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2 p-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-8 rounded bg-muted" />
      ))}
    </div>
  );
}

function LoadingKpis() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-24 rounded-lg border border-border bg-muted"
        />
      ))}
    </div>
  );
}

function DaySelector({
  days,
  setDays,
  options,
}: {
  days: number;
  setDays: (d: number) => void;
  options: number[];
}) {
  return (
    <div className="flex items-center rounded-md border border-border overflow-hidden">
      {options.map((d) => (
        <button
          key={d}
          onClick={() => setDays(d)}
          className={cn(
            "px-2.5 py-1 text-xs font-medium transition-colors",
            days === d
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const [days, setDays] = useState(7);

  const { data, isPending } = useQuery(
    trpc.reports.overview.queryOptions({ projectId, days }),
  );
  const { data: evSeries } = useQuery(
    trpc.events.timeSeries.queryOptions({ projectId, days }),
  );
  const { data: pvSeries } = useQuery(
    trpc.reports.pageViewTimeSeries.queryOptions({ projectId, days }),
  );
  const { data: frustration } = useQuery(
    trpc.reports.frustration.queryOptions({ projectId, days }),
  );

  if (isPending) return <LoadingKpis />;
  if (!data) return null;

  const kpis = [
    {
      label: "Events",
      value: data.events,
      change: data.eventsChange,
      series: evSeries ?? [],
      color: "#0070f3",
    },
    {
      label: "Page Views",
      value: data.pageViews,
      change: data.pageViewsChange,
      series: pvSeries ?? [],
      color: "#7928ca",
    },
    {
      label: "Sessions",
      value: data.sessions,
      change: 0,
      series: [],
      color: "#ff0080",
    },
    {
      label: "Open Errors",
      value: data.errorGroups,
      change: 0,
      series: [],
      color: "#e00",
      accent: data.errorGroups > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Overview</SectionTitle>
        <DaySelector days={days} setDays={setDays} options={[7, 14, 30]} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-lg border border-border bg-card p-4 space-y-2"
          >
            <p className="text-xs text-muted-foreground font-medium">
              {k.label}
            </p>
            <div className="flex items-end justify-between gap-1">
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums leading-none",
                  k.accent ? "text-destructive" : "text-foreground",
                )}
              >
                {k.value.toLocaleString()}
              </p>
              {k.change !== 0 && (
                <span
                  className={cn(
                    "text-[11px] font-medium mb-0.5",
                    k.change > 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-destructive",
                  )}
                >
                  {k.change > 0 ? "↑" : "↓"}
                  {Math.abs(k.change).toFixed(0)}%
                </span>
              )}
            </div>
            {k.series.length > 0 && (
              <Sparkline data={k.series} color={k.color} />
            )}
          </div>
        ))}
      </div>

      {/* Frustration */}
      {frustration && frustration.totalSessions > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: "Rage-click rate",
              value: `${frustration.ragePct}%`,
              sub: `${frustration.sessionsWithRage} sessions`,
              hot: frustration.ragePct > 10,
            },
            {
              label: "Error rate",
              value: `${frustration.errorPct}%`,
              sub: `${frustration.sessionsWithErrors} sessions`,
              hot: frustration.errorPct > 5,
            },
          ].map((s) => (
            <div
              key={s.label}
              className={cn(
                "rounded-lg border p-4",
                s.hot
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-card",
              )}
            >
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p
                className={cn(
                  "mt-1 text-2xl font-bold tabular-nums",
                  s.hot ? "text-destructive" : "text-foreground",
                )}
              >
                {s.value}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {s.sub}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Top tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TopTable
          title="Top Pages"
          rows={data.topPages.map((p) => ({ label: p.url, value: p.count }))}
          emptyMsg="No page views yet"
          color="#7928ca"
        />
        <TopTable
          title="Top Events"
          rows={data.topEvents.map((e) => ({ label: e.name, value: e.count }))}
          emptyMsg="No events yet"
          color="#0070f3"
        />
      </div>
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({
  data,
  color,
}: {
  data: { date: string; count: number }[];
  color: string;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-px h-7">
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm min-h-[2px] transition-all"
          style={{
            height: `${Math.max((d.count / max) * 100, d.count > 0 ? 8 : 4)}%`,
            backgroundColor: d.count > 0 ? color : "currentColor",
            opacity: d.count > 0 ? 0.75 : 0.1,
          }}
          title={`${d.date}: ${d.count}`}
        />
      ))}
    </div>
  );
}

// ─── TopTable ─────────────────────────────────────────────────────────────────

function TopTable({
  title,
  rows,
  emptyMsg,
  color = "#0070f3",
}: {
  title: string;
  rows: { label: string; value: number }[];
  emptyMsg: string;
  color?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <Panel>
      <PanelHeader>
        <span className="text-[13px] font-semibold text-foreground">
          {title}
        </span>
      </PanelHeader>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyMsg}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs text-foreground">{r.label}</p>
                <div className="mt-1 h-1 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(r.value / max) * 100}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                {r.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ─── Analytics tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const [days, setDays] = useState(14);
  const [heatmapPath, setHeatmapPath] = useState("/");

  const { data: scroll } = useQuery(
    trpc.reports.scrollDepth.queryOptions({ projectId, days }),
  );
  const { data: referrers } = useQuery(
    trpc.reports.referrers.queryOptions({ projectId, days }),
  );
  const { data: activity } = useQuery(
    trpc.reports.activityByHour.queryOptions({ projectId, days }),
  );
  const { data: frustration } = useQuery(
    trpc.reports.frustration.queryOptions({ projectId, days }),
  );
  const { data: heatmapData } = useQuery(
    trpc.reports.clickHeatmap.queryOptions({
      projectId,
      path: heatmapPath,
      days,
    }),
  );
  const { data: perf } = useQuery(
    trpc.reports.pagePerformance.queryOptions({ projectId, days }),
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <SectionTitle>Analytics</SectionTitle>
        <DaySelector days={days} setDays={setDays} options={[7, 14, 30, 90]} />
      </div>

      {/* Scroll depth */}
      <AnalyticsSection
        title="Scroll Depth"
        sub="How far users scroll on each page"
      >
        {!scroll?.length ? (
          <ChartEmpty label="No scroll data yet — the SDK tracks maxScrollY automatically" />
        ) : (
          <div className="space-y-3">
            {scroll.map((row) => (
              <div key={row.path} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-mono truncate max-w-[60%]">
                    {row.path}
                  </span>
                  <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                    <span>{row.views.toLocaleString()} views</span>
                    <span className="font-semibold text-foreground">
                      {row.avg}% avg
                    </span>
                  </div>
                </div>
                <div className="relative h-4 rounded bg-muted overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/60 rounded transition-all"
                    style={{ width: `${row.avg}%` }}
                  />
                  {[25, 50, 75].map((pct) => (
                    <div
                      key={pct}
                      className="absolute inset-y-0 w-px bg-border"
                      style={{ left: `${pct}%` }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </AnalyticsSection>

      {/* Traffic sources */}
      <AnalyticsSection title="Traffic Sources" sub="Where visitors come from">
        {!referrers?.sources.length ? (
          <ChartEmpty label="No referrer data yet" />
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              {referrers.sources.map((s) => (
                <div key={s.source} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-xs text-muted-foreground font-mono">
                    {s.source}
                  </span>
                  <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full rounded bg-primary/60 transition-all"
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {s.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <TrafficDonut
              sources={referrers.sources.slice(0, 6)}
              total={referrers.total}
            />
          </div>
        )}
      </AnalyticsSection>

      {/* Activity heatmap */}
      <AnalyticsSection
        title="Activity by Hour"
        sub="When your users are most active"
      >
        {!activity ? (
          <ChartEmpty label="Loading…" />
        ) : (
          <ActivityHeatmap grid={activity.grid} maxCount={activity.maxCount} />
        )}
      </AnalyticsSection>

      {/* Frustration signals */}
      <AnalyticsSection
        title="Frustration Signals"
        sub="Rage-clicks and dead-clicks"
      >
        {!frustration ? (
          <ChartEmpty label="Loading…" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Sessions",
                  value: frustration.totalSessions.toLocaleString(),
                  sub: `last ${days}d`,
                  hot: false,
                },
                {
                  label: "Rage-click rate",
                  value: `${frustration.ragePct}%`,
                  sub: `${frustration.sessionsWithRage} sessions`,
                  hot: frustration.ragePct > 10,
                },
                {
                  label: "Error rate",
                  value: `${frustration.errorPct}%`,
                  sub: `${frustration.sessionsWithErrors} sessions`,
                  hot: frustration.errorPct > 5,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg border border-border bg-card p-3.5"
                >
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  <p
                    className={cn(
                      "mt-1 text-xl font-bold tabular-nums",
                      s.hot ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {s.value}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {s.sub}
                  </p>
                </div>
              ))}
            </div>
            {frustration.rageClicks.length > 0 && (
              <div className="grid lg:grid-cols-2 gap-4">
                <ClickList
                  title="Top Rage-click Targets"
                  color="#e00"
                  items={frustration.rageClicks}
                />
                {frustration.deadClicks.length > 0 && (
                  <ClickList
                    title="Top Dead-click Targets"
                    color="#888"
                    items={frustration.deadClicks}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </AnalyticsSection>

      {/* Click heatmap */}
      <AnalyticsSection
        title="Click Heatmap"
        sub="Where users click on each page"
      >
        {heatmapData?.paths.length ? (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {heatmapData.paths.slice(0, 10).map((p) => (
              <button
                key={p.path}
                onClick={() => setHeatmapPath(p.path)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-mono transition-colors",
                  heatmapPath === p.path
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {p.path} <span className="opacity-50">{p.views}</span>
              </button>
            ))}
          </div>
        ) : null}
        {!heatmapData?.clicks.length ? (
          <ChartEmpty label="No click data for this page yet." />
        ) : (
          <ClickHeatmapCanvas clicks={heatmapData.clicks} />
        )}
      </AnalyticsSection>

      {/* Page performance */}
      <AnalyticsSection
        title="Page Performance"
        sub="Time spent and visitors per page"
      >
        {!perf?.length ? (
          <ChartEmpty label="Duration data is captured on page exit via the SDK." />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {[
                    "Page",
                    "Views",
                    "Unique visitors",
                    "Avg time",
                    "p50 time",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {perf.map((row) => (
                  <tr
                    key={row.path}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground max-w-[200px] truncate">
                      {row.path}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground">
                      {row.views.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground">
                      {row.uniqueVisitors.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-xs font-medium text-foreground">
                      {fmtMs(row.avgDuration)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground">
                      {fmtMs(row.p50Duration)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AnalyticsSection>
    </div>
  );
}

function AnalyticsSection({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-[13px] font-semibold text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
      {children}
    </div>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-10">
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        {label}
      </p>
    </div>
  );
}

// ─── Activity heatmap ─────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ActivityHeatmap({
  grid,
  maxCount,
}: {
  grid: { day: number; hour: number; count: number }[];
  maxCount: number;
}) {
  const lookup = new Map<string, number>();
  for (const c of grid) lookup.set(`${c.day}:${c.hour}`, c.count);
  const intensity = (count: number) =>
    count === 0 ? 0 : Math.max(0.08, count / maxCount);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px] space-y-1">
        <div className="flex items-center gap-0.5 pl-10">
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="flex-1 text-center text-[9px] text-muted-foreground"
            >
              {h % 6 === 0 ? `${h}h` : ""}
            </div>
          ))}
        </div>
        {DAY_LABELS.map((day, d) => (
          <div key={day} className="flex items-center gap-0.5">
            <span className="w-10 shrink-0 text-[10px] text-muted-foreground text-right pr-2">
              {day}
            </span>
            {Array.from({ length: 24 }, (_, h) => {
              const count = lookup.get(`${d}:${h}`) ?? 0;
              const alpha = intensity(count);
              return (
                <div
                  key={h}
                  className="flex-1 aspect-square rounded-[2px] transition-all"
                  style={{
                    backgroundColor:
                      alpha === 0 ? "var(--muted)" : `rgba(0,112,243,${alpha})`,
                  }}
                  title={`${day} ${h}:00 — ${count}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Traffic donut ────────────────────────────────────────────────────────────

const DONUT_COLORS = [
  "#0070f3",
  "#7928ca",
  "#ff0080",
  "#ff4d4d",
  "#f5a623",
  "#79ffe1",
];

function TrafficDonut({
  sources,
  total,
}: {
  sources: { source: string; count: number; pct: number }[];
  total: number;
}) {
  let cursor = 0;
  const stops = sources.map((s, i) => {
    const deg = (s.count / Math.max(total, 1)) * 360;
    const from = cursor;
    cursor += deg;
    return { color: DONUT_COLORS[i % DONUT_COLORS.length], from, to: cursor };
  });
  const gradient = stops
    .map((s) => `${s.color} ${s.from.toFixed(1)}deg ${s.to.toFixed(1)}deg`)
    .join(", ");

  return (
    <div className="flex items-center gap-6">
      <div
        className="shrink-0 h-24 w-24 rounded-full"
        style={{
          background: `conic-gradient(${gradient})`,
          WebkitMask: "radial-gradient(circle, transparent 42%, black 43%)",
          mask: "radial-gradient(circle, transparent 42%, black 43%)",
        }}
      />
      <div className="space-y-1.5">
        {sources.map((s, i) => (
          <div key={s.source} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {s.source}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums ml-auto">
              {s.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Click targets list ───────────────────────────────────────────────────────

function ClickList({
  title,
  color,
  items,
}: {
  title: string;
  color: string;
  items: { url: string; selector: string; count: number }[];
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <Panel>
      <PanelHeader>
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </PanelHeader>
      <div className="divide-y divide-border">
        {items.map((item, i) => (
          <div key={i} className="px-4 py-2.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <code className="text-[11px] text-muted-foreground truncate max-w-[70%]">
                {item.selector}
              </code>
              <span
                className="text-xs font-semibold tabular-nums shrink-0"
                style={{ color }}
              >
                {item.count}×
              </span>
            </div>
            <div className="h-1 rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(item.count / max) * 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Click heatmap canvas ─────────────────────────────────────────────────────

function ClickHeatmapCanvas({
  clicks,
}: {
  clicks: { x: number; y: number; type: string; selector: string | null }[];
}) {
  const [rendered, setRendered] = useState(false);
  const drawRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas || rendered) return;
      const W = canvas.width;
      const H = canvas.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "screen";
      for (const c of clicks) {
        const cx = (c.x / 1280) * W;
        const cy = (c.y / 800) * H;
        const r =
          c.type === "rage_click" ? 36 : c.type === "dead_click" ? 24 : 18;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        if (c.type === "rage_click") {
          grad.addColorStop(0, "rgba(224,0,0,0.7)");
          grad.addColorStop(1, "rgba(224,0,0,0)");
        } else if (c.type === "dead_click") {
          grad.addColorStop(0, "rgba(136,136,136,0.5)");
          grad.addColorStop(1, "rgba(136,136,136,0)");
        } else {
          grad.addColorStop(0, "rgba(0,112,243,0.55)");
          grad.addColorStop(1, "rgba(0,112,243,0)");
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      setRendered(true);
    },
    [clicks, rendered],
  );

  const rage = clicks.filter((c) => c.type === "rage_click").length;
  const dead = clicks.filter((c) => c.type === "dead_click").length;
  const normal = clicks.filter((c) => c.type === "click").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Clicks ({normal})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          Rage ({rage})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          Dead ({dead})
        </span>
      </div>
      <div className="relative rounded-lg overflow-hidden border border-border bg-black">
        <canvas
          ref={drawRef}
          width={1280}
          height={400}
          className="w-full block"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-[11px] text-muted-foreground">
            {clicks.length} click{clicks.length !== 1 ? "s" : ""} plotted
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Events tab ───────────────────────────────────────────────────────────────

function EventsTab({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const { data, isPending } = useQuery(
    trpc.events.list.queryOptions({ projectId, limit: 50 }),
  );

  if (isPending) return <LoadingRows />;

  return (
    <Panel>
      <PanelHeader>
        <span className="text-[13px] font-semibold text-foreground">
          Events
        </span>
        <span className="text-xs text-muted-foreground">
          {data?.events.length ?? 0} recent
        </span>
      </PanelHeader>
      {!data?.events.length ? (
        <EmptyState
          icon={
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z"
                clipRule="evenodd"
              />
            </svg>
          }
          title="No events yet"
          desc="Send your first event from the SDK or via the API."
          action={<IngestHint type="event" projectId={projectId} />}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Name", "Type", "URL", "Time"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.events.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground text-sm">
                    {e.name}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline">{e.type}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                    {e.url ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ─── Errors tab ───────────────────────────────────────────────────────────────

function ErrorsTab({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<
    "unresolved" | "resolved" | "ignored" | "all"
  >("unresolved");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const { data: groups, isPending } = useQuery(
    trpc.errors.list.queryOptions({
      projectId,
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: 50,
    }),
  );

  const updateStatus = useMutation(
    trpc.errors.updateStatus.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: trpc.errors.list.queryKey({ projectId }),
        });
        qc.invalidateQueries({
          queryKey: trpc.errors.groupById.queryKey({
            id: selectedGroupId ?? "",
          }),
        });
      },
    }),
  );

  if (isPending) return <LoadingRows />;

  const STATUS_PILL: Record<string, string> = {
    unresolved: "text-destructive bg-destructive/8 ring-1 ring-destructive/20",
    resolved:
      "text-green-700 dark:text-green-400 bg-green-500/10 ring-1 ring-green-500/20",
    ignored: "text-muted-foreground bg-muted ring-1 ring-border",
  };

  const filterBtns: ("unresolved" | "resolved" | "ignored" | "all")[] = [
    "unresolved",
    "resolved",
    "ignored",
    "all",
  ];

  return (
    <div className="flex gap-0 min-h-[540px] -mx-5 sm:-mx-6">
      {/* Issue list */}
      <div
        className={cn(
          "flex flex-col border-r border-border overflow-y-auto",
          selectedGroupId ? "w-[340px] shrink-0" : "flex-1",
        )}
      >
        <div className="sticky top-0 z-10 flex items-center gap-1 px-4 py-2.5 border-b border-border bg-background">
          {filterBtns.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                statusFilter === s
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {s}
            </button>
          ))}
          {groups && groups.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {groups.length} issue{groups.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {!groups?.length ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 py-16 text-center px-6">
            {statusFilter === "unresolved" ? (
              <>
                <span className="text-2xl">✓</span>
                <p className="text-sm font-medium text-foreground">All clear</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  No unresolved errors. Issues appear here automatically when
                  the SDK captures them.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No issues in this category.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() =>
                  setSelectedGroupId(g.id === selectedGroupId ? null : g.id)
                }
                className={cn(
                  "w-full text-left px-4 py-3.5 transition-colors",
                  selectedGroupId === g.id
                    ? "bg-muted/60"
                    : "hover:bg-muted/30",
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono font-medium bg-muted text-muted-foreground uppercase">
                      {g.type}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        STATUS_PILL[g.status] ?? STATUS_PILL.unresolved,
                      )}
                    >
                      {g.status}
                    </span>
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground font-mono">
                    {g.occurrences.toLocaleString()}×
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                  {g.message}
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>First {relativeTime(new Date(g.firstSeenAt))}</span>
                  <span>·</span>
                  <span>Last {relativeTime(new Date(g.lastSeenAt))}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedGroupId && (
        <div className="flex-1 min-w-0 overflow-y-auto bg-background">
          <ErrorDetail
            groupId={selectedGroupId}
            onClose={() => setSelectedGroupId(null)}
            onUpdateStatus={(id, status) => updateStatus.mutate({ id, status })}
            isUpdating={updateStatus.isPending}
          />
        </div>
      )}
    </div>
  );
}

// ─── Error detail panel ───────────────────────────────────────────────────────

function ErrorDetail({
  groupId,
  onClose,
  onUpdateStatus,
  isUpdating,
}: {
  groupId: string;
  onClose: () => void;
  onUpdateStatus: (
    id: string,
    status: "unresolved" | "resolved" | "ignored",
  ) => void;
  isUpdating: boolean;
}) {
  const trpc = useTRPC();
  const [selectedEventIdx, setSelectedEventIdx] = useState(0);
  const [stackExpanded, setStackExpanded] = useState(true);
  const [breadcrumbsExpanded, setBreadcrumbsExpanded] = useState(true);
  const { data: group, isPending } = useQuery(
    trpc.errors.groupById.queryOptions({ id: groupId }),
  );

  if (isPending) return <LoadingRows />;
  if (!group)
    return (
      <div className="p-6 text-sm text-muted-foreground">Error not found.</div>
    );

  const events = group.events ?? [];
  const event = events[selectedEventIdx] ?? null;
  const stackLines = parseStack(event?.stack ?? null);
  type Breadcrumb = {
    type: string;
    message: string;
    ts: number;
    data?: unknown;
  };
  let breadcrumbs: Breadcrumb[] = [];
  try {
    breadcrumbs = JSON.parse(event?.breadcrumbs ?? "[]");
  } catch {}

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 flex items-start gap-3 px-5 py-3.5 border-b border-border bg-background">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-mono font-medium bg-destructive/10 text-destructive ring-1 ring-destructive/20 uppercase">
              {group.type}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {group.occurrences.toLocaleString()} occurrence
              {group.occurrences !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug break-words">
            {group.message}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {group.status !== "resolved" && (
            <button
              onClick={() => onUpdateStatus(group.id, "resolved")}
              disabled={isUpdating}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Resolve
            </button>
          )}
          {group.status !== "ignored" && (
            <button
              onClick={() => onUpdateStatus(group.id, "ignored")}
              disabled={isUpdating}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Ignore
            </button>
          )}
          {group.status !== "unresolved" && (
            <button
              onClick={() => onUpdateStatus(group.id, "unresolved")}
              disabled={isUpdating}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Reopen
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-1 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
          </button>
        </div>
      </div>

      {events.length > 1 && (
        <div className="flex items-center gap-2 px-5 py-2 border-b border-border bg-muted/20">
          <span className="text-xs text-muted-foreground">Occurrence:</span>
          <div className="flex items-center gap-1">
            {events.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelectedEventIdx(i)}
                className={cn(
                  "h-5 w-5 rounded text-[10px] font-mono transition-colors",
                  selectedEventIdx === i
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
          {event && (
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date(event.createdAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <DetailSection
          title="Stack Trace"
          expanded={stackExpanded}
          onToggle={() => setStackExpanded((v) => !v)}
        >
          {!event?.stack && !stackLines.length ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">
              No stack trace captured.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-0 font-mono text-xs bg-zinc-950 dark:bg-black">
                <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                  <span className="text-red-400 font-semibold">
                    {group.type}
                  </span>
                  <span className="text-zinc-300">: {group.message}</span>
                </div>
                {stackLines.length > 0 ? (
                  stackLines.map((line, i) => (
                    <StackFrame key={i} frame={line} isTop={i === 0} />
                  ))
                ) : (
                  <pre className="px-4 py-3 text-zinc-400 whitespace-pre-wrap leading-relaxed text-[11px]">
                    {event?.stack}
                  </pre>
                )}
              </div>
            </div>
          )}
        </DetailSection>

        {breadcrumbs.length > 0 && (
          <DetailSection
            title={`Breadcrumbs (${breadcrumbs.length})`}
            expanded={breadcrumbsExpanded}
            onToggle={() => setBreadcrumbsExpanded((v) => !v)}
          >
            <div className="divide-y divide-border">
              {[...breadcrumbs].reverse().map((b, i) => {
                const style =
                  BREADCRUMB_STYLES[b.type] ?? BREADCRUMB_STYLES.default;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px]",
                        style.bg,
                      )}
                    >
                      {style.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={cn(
                            "text-[10px] font-medium uppercase tracking-wide",
                            style.label,
                          )}
                        >
                          {b.type}
                        </span>
                        <span className="text-[11px] text-foreground truncate">
                          {b.message}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] font-mono text-muted-foreground tabular-nums">
                      {b.ts ? new Date(b.ts).toLocaleTimeString() : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </DetailSection>
        )}

        {event && (
          <DetailSection title="Environment" expanded>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 px-4 py-3">
              {[
                ["URL", event.url],
                [
                  "Line",
                  event.line != null
                    ? `${event.line}${event.col != null ? `:${event.col}` : ""}`
                    : null,
                ],
                ["Visitor", event.visitorId],
                ["IP", event.ipAddress],
                ["User Agent", event.userAgent],
                ["Captured", new Date(event.createdAt).toLocaleString()],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k as string} className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">
                      {k as string}
                    </p>
                    <p className="text-xs text-foreground truncate font-mono">
                      {v as string}
                    </p>
                  </div>
                ))}
            </div>
          </DetailSection>
        )}
      </div>
    </div>
  );
}

// ─── Stack frame ──────────────────────────────────────────────────────────────

interface ParsedFrame {
  raw: string;
  fn: string | null;
  file: string | null;
  line: number | null;
  col: number | null;
  isInternal: boolean;
}

function parseStack(stack: string | null | undefined): ParsedFrame[] {
  if (!stack) return [];
  return stack
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("at "))
    .map((raw) => {
      const match =
        raw.match(/^at (.+?) \((.+?):(\d+):(\d+)\)$/) ??
        raw.match(/^at (.+?):(\d+):(\d+)$/);
      if (!match)
        return {
          raw,
          fn: null,
          file: null,
          line: null,
          col: null,
          isInternal: false,
        };
      if (match.length === 5)
        return {
          raw,
          fn: match[1],
          file: match[2],
          line: parseInt(match[3]),
          col: parseInt(match[4]),
          isInternal: isInternalFrame(match[2]!),
        };
      return {
        raw,
        fn: null,
        file: match[1],
        line: parseInt(match[2]),
        col: parseInt(match[3]),
        isInternal: isInternalFrame(match[1]!),
      };
    });
}

function isInternalFrame(file: string) {
  return (
    file.includes("node_modules") ||
    file.startsWith("node:") ||
    file.includes("<anonymous>") ||
    file.includes("webpack-internal") ||
    file.includes("next/dist")
  );
}

function StackFrame({ frame, isTop }: { frame: ParsedFrame; isTop: boolean }) {
  const dim = frame.isInternal;
  return (
    <div
      className={cn(
        "flex items-start border-b border-zinc-800/50 last:border-0",
        isTop ? "bg-red-950/20" : dim ? "opacity-40" : "",
      )}
    >
      <div
        className={cn(
          "w-1 self-stretch shrink-0",
          isTop ? "bg-red-500" : "bg-transparent",
        )}
      />
      <div className="flex-1 px-3 py-2 min-w-0">
        <p
          className={cn(
            "text-[12px] leading-tight",
            isTop
              ? "text-zinc-100 font-medium"
              : dim
                ? "text-zinc-600"
                : "text-zinc-300",
          )}
        >
          {frame.fn ?? "<anonymous>"}
        </p>
        {frame.file && (
          <p
            className={cn(
              "text-[11px] mt-0.5",
              isTop ? "text-zinc-400" : "text-zinc-600",
            )}
          >
            <span className={cn(isTop ? "text-zinc-300" : "text-zinc-500")}>
              {shortenPath(frame.file)}
            </span>
            {frame.line != null && (
              <span
                className={cn("ml-1", isTop ? "text-red-400" : "text-zinc-600")}
              >
                :{frame.line}
                {frame.col != null ? `:${frame.col}` : ""}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function shortenPath(file: string) {
  try {
    const url = new URL(file);
    return url.pathname;
  } catch {}
  const parts = file.replace(/\\/g, "/").split("/");
  return parts.length > 4 ? "…/" + parts.slice(-3).join("/") : file;
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function DetailSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors uppercase tracking-wider"
      >
        {title}
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            expanded ? "rotate-180" : "",
          )}
        >
          <path d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" />
        </svg>
      </button>
      {expanded && <div>{children}</div>}
    </div>
  );
}

const BREADCRUMB_STYLES: Record<
  string,
  { icon: string; bg: string; label: string }
> = {
  "console.error": {
    icon: "✕",
    bg: "bg-red-100 dark:bg-red-900/30 text-red-500",
    label: "text-red-500",
  },
  "console.warn": {
    icon: "!",
    bg: "bg-amber-100 dark:bg-amber-900/30 text-amber-500",
    label: "text-amber-500",
  },
  "console.log": {
    icon: "›",
    bg: "bg-muted text-muted-foreground",
    label: "text-muted-foreground",
  },
  click: { icon: "↗", bg: "bg-primary/10 text-primary", label: "text-primary" },
  error: {
    icon: "✕",
    bg: "bg-red-100 dark:bg-red-900/30 text-red-500",
    label: "text-red-500",
  },
  default: {
    icon: "·",
    bg: "bg-muted text-muted-foreground",
    label: "text-muted-foreground",
  },
};

// ─── Sessions tab ─────────────────────────────────────────────────────────────

function SessionsTab({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: sessions, isPending } = useQuery(
    trpc.sessions.list.queryOptions({ projectId, limit: 50 }),
  );

  if (isPending) return <LoadingRows />;

  const fmtDur = (ms: number) => {
    if (!ms) return "< 1s";
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };
  const fmtPath = (url: string | null) => {
    if (!url) return "—";
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  };

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader>
          <span className="text-[13px] font-semibold text-foreground">
            Session Recordings
          </span>
          {selectedId && (
            <button
              onClick={() => setSelectedId(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕ Close replay
            </button>
          )}
        </PanelHeader>

        {!sessions?.length ? (
          <EmptyState
            icon={
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
            }
            title="No session recordings yet"
            desc="Sessions are automatically captured by the SDK and flushed every 5s and on page unload."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    "Visitor",
                    "Start URL",
                    "Duration",
                    "Clicks",
                    "Errors",
                    "Started",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() =>
                      setSelectedId(s.id === selectedId ? null : s.id)
                    }
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedId === s.id
                        ? "bg-primary/5"
                        : "hover:bg-muted/30",
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <code className="text-xs text-muted-foreground font-mono">
                        {s.visitorId.slice(0, 8)}…
                      </code>
                    </td>
                    <td className="px-4 py-2.5 max-w-[160px]">
                      <p className="truncate text-xs text-foreground">
                        {fmtPath(s.startUrl)}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-xs text-foreground whitespace-nowrap">
                      {fmtDur(s.duration)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-xs text-foreground">
                      {s.clickCount}
                      {s.rageClickCount > 0 && (
                        <span className="ml-1.5 text-[10px] text-orange-500">
                          {s.rageClickCount} rage
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.errorCount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 border border-destructive/20 px-2 py-0.5 text-[11px] font-medium text-destructive">
                          {s.errorCount} error{s.errorCount !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-primary whitespace-nowrap">
                      {selectedId === s.id ? "▲ Hide" : "▶ Watch"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selectedId && (
        <div className="rounded-lg overflow-hidden border border-border shadow-md">
          <SessionReplay sessionId={selectedId} />
        </div>
      )}
    </div>
  );
}

// ─── Page views tab ───────────────────────────────────────────────────────────

function PageViewsTab({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const { data, isPending } = useQuery(
    trpc.reports.overview.queryOptions({ projectId, days: 30 }),
  );

  if (isPending) return <LoadingRows />;

  return (
    <Panel>
      <PanelHeader>
        <span className="text-[13px] font-semibold text-foreground">
          Top Pages
        </span>
        <span className="text-xs text-muted-foreground">last 30 days</span>
      </PanelHeader>
      {!data?.topPages.length ? (
        <EmptyState
          icon={
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path
                fillRule="evenodd"
                d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                clipRule="evenodd"
              />
            </svg>
          }
          title="No page views yet"
          desc="Page views are tracked automatically by the SDK."
          action={<IngestHint type="pageview" projectId={projectId} />}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Page", "Views"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.topPages.map((p) => (
                <tr key={p.url} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 text-sm text-foreground">
                    {p.url}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-medium text-foreground">
                    {p.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ─── API keys tab ─────────────────────────────────────────────────────────────

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
      onSuccess: () =>
        qc.invalidateQueries({
          queryKey: trpc.projects.listApiKeys.queryKey({ projectId }),
        }),
    }),
  );

  return (
    <div className="space-y-4">
      {/* New key banner */}
      {newKey && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 space-y-2">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            Your new API key — copy it now, it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-background border border-border px-3 py-2 text-xs font-mono text-foreground break-all">
              {newKey}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(newKey)}
              className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="text-xs text-green-700 dark:text-green-400 hover:underline"
          >
            I&apos;ve saved it ✓
          </button>
        </div>
      )}

      <Panel>
        <PanelHeader>
          <span className="text-[13px] font-semibold text-foreground">
            API Keys
          </span>
          <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
            New key
          </Button>
        </PanelHeader>

        {isPending ? (
          <LoadingRows />
        ) : !keys?.length ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No API keys yet. Create one to start sending data.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Name", "Prefix", "Last used", "Created", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {keys.map((k) => (
                  <tr
                    key={k.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {k.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                        {k.prefix}••••••••
                      </code>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {k.lastUsedAt
                        ? new Date(k.lastUsedAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => revoke.mutate({ id: k.id })}
                        className="text-xs text-destructive hover:underline"
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
      </Panel>

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
                {create.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Setup tab ────────────────────────────────────────────────────────────────

function SetupTab({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const INGEST = process.env.NEXT_PUBLIC_INGEST_URL;

  if (!INGEST) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 max-w-2xl">
        <p className="text-sm font-medium text-destructive">
          NEXT_PUBLIC_INGEST_URL is not configured
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Set it in <code className="font-mono">apps/web/.env</code> and restart
          the dev server. SDK setup and curl snippets require this URL.
        </p>
      </div>
    );
  }

  const snippets = [
    {
      key: "script",
      title: "1. Add the script tag",
      desc: "Drop this into your HTML <head>. It auto-tracks page views, clicks, and errors.",
      lang: "html",
      code: `<script
  src="${INGEST}/clarity.js"
  data-project-id="${projectId}"
  data-api-key="YOUR_API_KEY"
  defer
></script>`,
    },
    {
      key: "event",
      title: "2. Track a custom event",
      desc: "Call clarity.track() anywhere in your JS to send a named event.",
      lang: "javascript",
      code: `// After the script loads
window.clarity.track("button_click", {
  label: "Sign up CTA",
  page: window.location.pathname,
});`,
    },
    {
      key: "pageview",
      title: "3. Manual page view (SPAs)",
      desc: "For single-page apps, call this on every route change.",
      lang: "javascript",
      code: `// e.g. in your router's onChange callback
window.clarity.page(window.location.href);`,
    },
    {
      key: "curl",
      title: "4. Verify with curl",
      desc: "Test the ingest endpoint directly before wiring up your app.",
      lang: "bash",
      code: `curl -X POST ${INGEST}/track/event \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"project_id":"${projectId}","name":"test","url":"/"}'`,
    },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">SDK Setup</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Get up and running in under 2 minutes. No build step required.
        </p>
      </div>

      {/* Prerequisites */}
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-1">
        <p className="text-xs font-semibold text-foreground">
          Before you start
        </p>
        <ul className="space-y-0.5 text-xs text-muted-foreground list-disc list-inside">
          <li>Create a project (you're here ✓)</li>
          <li>
            Generate an API key in the{" "}
            <strong className="text-foreground">API keys</strong> tab
          </li>
          <li>
            Ingest service running at{" "}
            <code className="font-mono bg-background border border-border rounded px-1 text-[11px]">
              {INGEST}
            </code>
          </li>
        </ul>
      </div>

      {/* Code snippets */}
      {snippets.map((s) => (
        <div key={s.key} className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold text-foreground">
                {s.title}
              </p>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b border-border">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                {s.lang}
              </span>
              <button
                onClick={() => copy(s.key, s.code)}
                className={cn(
                  "text-[11px] font-medium transition-colors",
                  copied === s.key
                    ? "text-green-600 dark:text-green-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {copied === s.key ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto p-4 text-[12px] font-mono text-foreground bg-card leading-relaxed whitespace-pre">
              {s.code}
            </pre>
          </div>
        </div>
      ))}

      {/* API reference */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted/40 border-b border-border">
          <p className="text-[13px] font-semibold text-foreground">
            API reference
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            All endpoints accept JSON with{" "}
            <code className="font-mono bg-background border border-border rounded px-1 text-[11px]">
              X-API-Key
            </code>{" "}
            header.
          </p>
        </div>
        <div className="divide-y divide-border">
          {[
            {
              method: "POST",
              path: "/track/event",
              desc: "Track a custom event",
            },
            {
              method: "POST",
              path: "/track/pageview",
              desc: "Track a page view",
            },
            {
              method: "POST",
              path: "/track/error",
              desc: "Capture a JS error",
            },
            {
              method: "POST",
              path: "/session/start",
              desc: "Start a session recording",
            },
            {
              method: "POST",
              path: "/session/frames",
              desc: "Flush recording frames",
            },
            { method: "GET", path: "/health", desc: "Health check (no auth)" },
          ].map((ep) => (
            <div key={ep.path} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold font-mono uppercase",
                  ep.method === "GET"
                    ? "bg-green-500/10 text-green-700 dark:text-green-400"
                    : "bg-primary/10 text-primary",
                )}
              >
                {ep.method}
              </span>
              <code className="text-xs font-mono text-foreground">
                {ep.path}
              </code>
              <span className="text-xs text-muted-foreground ml-auto hidden sm:block">
                {ep.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── IngestHint (inline curl helper for empty states) ─────────────────────────

function IngestHint({
  type,
  projectId,
}: {
  type: "event" | "pageview";
  projectId: string;
}) {
  const endpoint = type === "event" ? "/track/event" : "/track/pageview";
  const body =
    type === "event"
      ? `{"project_id":"${projectId}","name":"button_click","url":"/"}`
      : `{"project_id":"${projectId}","url":"https://yoursite.com/"}`;

  return (
    <div className="mt-4 space-y-2 text-left max-w-xl">
      <p className="text-xs text-muted-foreground">Try it with curl:</p>
      <pre className="overflow-x-auto rounded-md bg-zinc-950 dark:bg-black p-3 text-[11px] text-zinc-300 font-mono leading-relaxed">
        {`curl -X POST ${
          process.env.NEXT_PUBLIC_INGEST_URL ?? "(NEXT_PUBLIC_INGEST_URL not set)"
        }${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: <your-api-key>" \\
  -d '${body}'`}
      </pre>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtMs(ms: number): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
