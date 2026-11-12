import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/org-access";

export const eventsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        name: z.string().optional(),
        type: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      const events = await prisma.event.findMany({
        where: {
          projectId: input.projectId,
          ...(input.name && { name: input.name }),
          ...(input.type && { type: input.type }),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      });
      let nextCursor: string | undefined;
      if (events.length > input.limit) nextCursor = events.pop()!.id;
      return { events, nextCursor };
    }),

  summary: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        days: z.number().min(1).max(90).default(7),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      const since = new Date(Date.now() - input.days * 86_400_000);
      const groups = await prisma.event.groupBy({
        by: ["name"],
        where: { projectId: input.projectId, createdAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 20,
      });
      return groups.map((g) => ({ name: g.name, count: g._count.id }));
    }),

  timeSeries: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        days: z.number().min(1).max(90).default(14),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      const since = new Date(Date.now() - input.days * 86_400_000);
      const events = await prisma.event.findMany({
        where: { projectId: input.projectId, createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      return bucketByDay(
        events.map((e) => e.createdAt),
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
