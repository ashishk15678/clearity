import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/org-access";

export const reportsRouter = createTRPCRouter({
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
});

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
