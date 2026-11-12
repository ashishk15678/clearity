import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/org-access";

export const sessionsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      return prisma.sessionRecording.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          visitorId: true,
          startUrl: true,
          userAgent: true,
          duration: true,
          clickCount: true,
          rageClickCount: true,
          errorCount: true,
          deviceType: true,
          browser: true,
          os: true,
          createdAt: true,
          _count: { select: { errorEvents: true, chunks: true } },
        },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const rec = await prisma.sessionRecording.findUnique({
        where: { id: input.id },
        include: {
          project: { select: { organizationId: true } },
          chunks: { orderBy: { sequence: "asc" } },
          errorEvents: {
            include: {
              group: { select: { message: true, type: true, status: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!rec) return null;
      await requireProjectAccess(ctx.user.id, rec.projectId);
      return rec;
    }),

  stats: protectedProcedure
    .input(z.object({ projectId: z.string(), days: z.number().default(7) }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      const since = new Date(Date.now() - input.days * 86_400_000);
      const [total, withErrors, withRageClicks] = await Promise.all([
        prisma.sessionRecording.count({
          where: { projectId: input.projectId, createdAt: { gte: since } },
        }),
        prisma.sessionRecording.count({
          where: {
            projectId: input.projectId,
            createdAt: { gte: since },
            errorCount: { gt: 0 },
          },
        }),
        prisma.sessionRecording.count({
          where: {
            projectId: input.projectId,
            createdAt: { gte: since },
            rageClickCount: { gt: 0 },
          },
        }),
      ]);
      return { total, withErrors, withRageClicks };
    }),
});
