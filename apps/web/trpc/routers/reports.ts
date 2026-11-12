import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/org-access";

export const reportsRouter = createTRPCRouter({
  // ─── Existing: overview ─────────────────────────────────────────────────────
  overview: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        days: z.number().min(1).max(90).default(7),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      const since = new Date(Date.now() - input.days * 86_400_000);
      const prevSince = new Date(Date.now() - input.days * 2 * 86_400_000);

      const [
        events,
        pageViews,
        prevEvents,
        prevPageViews,
        topPages,
        topEvents,
        errorGroups,
        sessions,
      ] = await Promise.all([
        prisma.event.count({
          where: { projectId: input.projectId, createdAt: { gte: since } },
        }),
        prisma.pageView.count({
          where: { projectId: input.projectId, createdAt: { gte: since } },
        }),
        prisma.event.count({
          where: {
            projectId: input.projectId,
            createdAt: { gte: prevSince, lt: since },
          },
        }),
        prisma.pageView.count({
          where: {
            projectId: input.projectId,
            createdAt: { gte: prevSince, lt: since },
          },
        }),
        prisma.pageView.groupBy({
          by: ["path"],
          where: { projectId: input.projectId, createdAt: { gte: since } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 5,
        }),
        prisma.event.groupBy({
          by: ["name"],
          where: { projectId: input.projectId, createdAt: { gte: since } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 5,
        }),
        prisma.errorGroup.count({
          where: { projectId: input.projectId, status: "unresolved" },
        }),
        prisma.sessionRecording.count({
          where: { projectId: input.projectId, createdAt: { gte: since } },
        }),
      ]);

      return {
        events,
        pageViews,
        sessions,
        errorGroups,
        eventsChange:
          prevEvents > 0 ? ((events - prevEvents) / prevEvents) * 100 : 0,
        pageViewsChange:
          prevPageViews > 0
            ? ((pageViews - prevPageViews) / prevPageViews) * 100
            : 0,
        topPages: topPages.map((p) => ({ url: p.path, count: p._count.id })),
        topEvents: topEvents.map((e) => ({ name: e.name, count: e._count.id })),
      };
    }),

  // ─── Existing: pageViewTimeSeries ────────────────────────────────────────────
  pageViewTimeSeries: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        days: z.number().min(1).max(90).default(14),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      const since = new Date(Date.now() - input.days * 86_400_000);
      const views = await prisma.pageView.findMany({
        where: { projectId: input.projectId, createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      return bucketByDay(
        views.map((v) => v.createdAt),
        input.days,
      );
    }),

  // ─── NEW: scrollDepth ────────────────────────────────────────────────────────
  // Returns how far users scroll on each page as bucketed percentages.
  // Each row: { path, avg, p50, p75, p90, views }
  scrollDepth: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        days: z.number().min(1).max(90).default(14),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      const since = new Date(Date.now() - input.days * 86_400_000);

      // Fetch all pageviews with maxScrollY for this project
      const views = await prisma.pageView.findMany({
        where: {
          projectId: input.projectId,
          createdAt: { gte: since },
          maxScrollY: { not: null },
        },
        select: { path: true, maxScrollY: true },
        orderBy: { createdAt: "desc" },
        take: 5000, // cap for perf
      });

      // Group by path, compute stats
      const byPath = new Map<string, number[]>();
      for (const v of views) {
        const pct = v.maxScrollY ?? 0;
        if (!byPath.has(v.path)) byPath.set(v.path, []);
        byPath.get(v.path)!.push(pct);
      }

      return Array.from(byPath.entries())
        .map(([path, vals]) => {
          const sorted = [...vals].sort((a, b) => a - b);
          const n = sorted.length;
          return {
            path,
            views: n,
            avg: Math.round(vals.reduce((s, v) => s + v, 0) / n),
            p50: sorted[Math.floor(n * 0.5)] ?? 0,
            p75: sorted[Math.floor(n * 0.75)] ?? 0,
            p90: sorted[Math.floor(n * 0.9)] ?? 0,
          };
        })
        .sort((a, b) => b.views - a.views)
        .slice(0, input.limit);
    }),

  // ─── NEW: referrers ──────────────────────────────────────────────────────────
  // Traffic sources — top referrer domains + direct traffic share.
  referrers: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        days: z.number().min(1).max(90).default(14),
        limit: z.number().min(1).max(30).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      const since = new Date(Date.now() - input.days * 86_400_000);

      const views = await prisma.pageView.findMany({
        where: { projectId: input.projectId, createdAt: { gte: since } },
        select: { referrer: true },
        take: 5000,
      });

      const total = views.length;
      const counts = new Map<string, number>();

      for (const v of views) {
        let source = "Direct / None";
        if (v.referrer) {
          try {
            source = new URL(v.referrer).hostname.replace(/^www\./, "");
          } catch {
            source = v.referrer.slice(0, 60);
          }
        }
        counts.set(source, (counts.get(source) ?? 0) + 1);
      }

      return {
        total,
        sources: Array.from(counts.entries())
          .map(([source, count]) => ({
            source,
            count,
            pct: total > 0 ? Math.round((count / total) * 100) : 0,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, input.limit),
      };
    }),

  // ─── NEW: activityByHour ─────────────────────────────────────────────────────
  // Heatmap of when users are most active: 7 days × 24 hours grid.
  activityByHour: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        days: z.number().min(7).max(90).default(28),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      const since = new Date(Date.now() - input.days * 86_400_000);

      const [pvRows, evRows] = await Promise.all([
        prisma.pageView.findMany({
          where: { projectId: input.projectId, createdAt: { gte: since } },
          select: { createdAt: true },
          take: 10000,
        }),
        prisma.event.findMany({
          where: { projectId: input.projectId, createdAt: { gte: since } },
          select: { createdAt: true },
          take: 10000,
        }),
      ]);

      // Build 7×24 grid (day-of-week 0=Sun, hour 0-23)
      const grid: number[][] = Array.from({ length: 7 }, () =>
        new Array(24).fill(0),
      );
      for (const r of [...pvRows, ...evRows]) {
        const d = new Date(r.createdAt);
        grid[d.getDay()][d.getHours()]++;
      }

      const flat = grid.flatMap((row, day) =>
        row.map((count, hour) => ({ day, hour, count })),
      );
      return { grid: flat, maxCount: Math.max(...flat.map((c) => c.count), 1) };
    }),

  // ─── NEW: frustration ────────────────────────────────────────────────────────
  // Rage-click & dead-click rates per page, and overall frustration signals.
  frustration: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        days: z.number().min(1).max(90).default(14),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      const since = new Date(Date.now() - input.days * 86_400_000);

      const [rage, dead, totalSessions, sessionsWithRage, sessionsWithErrors] =
        await Promise.all([
          // Top rage-click targets
          prisma.event.groupBy({
            by: ["url", "selector"],
            where: {
              projectId: input.projectId,
              type: "rage_click",
              createdAt: { gte: since },
            },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 10,
          }),
          // Top dead-click targets
          prisma.event.groupBy({
            by: ["url", "selector"],
            where: {
              projectId: input.projectId,
              type: "dead_click",
              createdAt: { gte: since },
            },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 10,
          }),
          prisma.sessionRecording.count({
            where: { projectId: input.projectId, createdAt: { gte: since } },
          }),
          prisma.sessionRecording.count({
            where: {
              projectId: input.projectId,
              createdAt: { gte: since },
              rageClickCount: { gt: 0 },
            },
          }),
          prisma.sessionRecording.count({
            where: {
              projectId: input.projectId,
              createdAt: { gte: since },
              errorCount: { gt: 0 },
            },
          }),
        ]);

      return {
        totalSessions,
        sessionsWithRage,
        sessionsWithErrors,
        ragePct:
          totalSessions > 0
            ? Math.round((sessionsWithRage / totalSessions) * 100)
            : 0,
        errorPct:
          totalSessions > 0
            ? Math.round((sessionsWithErrors / totalSessions) * 100)
            : 0,
        rageClicks: rage.map((r) => ({
          url: r.url ?? "",
          selector: r.selector ?? "(unknown)",
          count: r._count.id,
        })),
        deadClicks: dead.map((d) => ({
          url: d.url ?? "",
          selector: d.selector ?? "(unknown)",
          count: d._count.id,
        })),
      };
    }),

  // ─── NEW: clickHeatmap ───────────────────────────────────────────────────────
  // Raw click x/y coordinates for a given URL path (for canvas heatmap).
  clickHeatmap: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        path: z.string().default("/"),
        days: z.number().min(1).max(90).default(14),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      const since = new Date(Date.now() - input.days * 86_400_000);

      // Get all pages for path selector list
      const paths = await prisma.pageView.groupBy({
        by: ["path"],
        where: { projectId: input.projectId, createdAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 20,
      });

      // Get click events for the selected path
      const clicks = await prisma.event.findMany({
        where: {
          projectId: input.projectId,
          type: { in: ["click", "rage_click", "dead_click"] },
          url: { contains: input.path },
          x: { not: null },
          y: { not: null },
          createdAt: { gte: since },
        },
        select: { x: true, y: true, type: true, selector: true },
        take: 2000,
      });

      return {
        paths: paths.map((p) => ({ path: p.path, views: p._count.id })),
        clicks: clicks.map((c) => ({
          x: c.x!,
          y: c.y!,
          type: c.type,
          selector: c.selector,
        })),
      };
    }),

  // ─── NEW: pagePerformance ────────────────────────────────────────────────────
  // Avg time on page and bounce rate (single page view sessions) per path.
  pagePerformance: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        days: z.number().min(1).max(90).default(14),
        limit: z.number().min(1).max(30).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      const since = new Date(Date.now() - input.days * 86_400_000);

      const views = await prisma.pageView.findMany({
        where: {
          projectId: input.projectId,
          createdAt: { gte: since },
          duration: { not: null },
        },
        select: { path: true, duration: true, visitorId: true },
        take: 10000,
      });

      // Group by path
      const byPath = new Map<
        string,
        { durations: number[]; visitors: Set<string> }
      >();
      for (const v of views) {
        if (!byPath.has(v.path))
          byPath.set(v.path, { durations: [], visitors: new Set() });
        const entry = byPath.get(v.path)!;
        entry.durations.push(v.duration!);
        if (v.visitorId) entry.visitors.add(v.visitorId);
      }

      return Array.from(byPath.entries())
        .map(([path, { durations, visitors }]) => {
          const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
          const sorted = [...durations].sort((a, b) => a - b);
          return {
            path,
            views: durations.length,
            uniqueVisitors: visitors.size,
            avgDuration: Math.round(avg),
            p50Duration: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
          };
        })
        .sort((a, b) => b.views - a.views)
        .slice(0, input.limit);
    }),
});

// ─── Shared helpers ───────────────────────────────────────────────────────────

function bucketByDay(dates: Date[], days: number) {
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const d of dates) {
    const key = d.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
}
