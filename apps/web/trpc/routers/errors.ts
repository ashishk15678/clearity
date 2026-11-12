import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/org-access";

export const errorsRouter = createTRPCRouter({
  /** List ErrorGroups (deduplicated issues) for a project. */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        status: z.enum(["unresolved", "resolved", "ignored"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      return prisma.errorGroup.findMany({
        where: {
          projectId: input.projectId,
          ...(input.status && { status: input.status }),
        },
        orderBy: { lastSeenAt: "desc" },
        take: input.limit,
      });
    }),

  /** Single error group + its recent events. */
  groupById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const group = await prisma.errorGroup.findUnique({
        where: { id: input.id },
        include: {
          events: {
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { recording: { select: { id: true, visitorId: true } } },
          },
        },
      });
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });
      await requireProjectAccess(ctx.user.id, group.projectId);
      return group;
    }),

  /** Change status of an error group. */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["unresolved", "resolved", "ignored"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const group = await prisma.errorGroup.findUnique({
        where: { id: input.id },
      });
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });
      await requireProjectAccess(ctx.user.id, group.projectId, "MEMBER");
      return prisma.errorGroup.update({
        where: { id: input.id },
        data: {
          status: input.status,
          resolvedAt: input.status === "resolved" ? new Date() : null,
        },
      });
    }),

  /** Stats summary — total issues, unresolved, new this period. */
  stats: protectedProcedure
    .input(z.object({ projectId: z.string(), days: z.number().default(7) }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      const since = new Date(Date.now() - input.days * 86_400_000);
      const [total, unresolved, newThisPeriod] = await Promise.all([
        prisma.errorGroup.count({ where: { projectId: input.projectId } }),
        prisma.errorGroup.count({
          where: { projectId: input.projectId, status: "unresolved" },
        }),
        prisma.errorGroup.count({
          where: { projectId: input.projectId, firstSeenAt: { gte: since } },
        }),
      ]);
      return { total, unresolved, newThisPeriod };
    }),
});
