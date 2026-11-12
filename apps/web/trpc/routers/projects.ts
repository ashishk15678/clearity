import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { nanoid } from "@/lib/nanoid";
import { requireOrgMember, requireProjectAccess } from "@/lib/org-access";

export const projectsRouter = createTRPCRouter({
  /** List all projects the user can see across all their orgs. */
  list: protectedProcedure
    .input(z.object({ organizationId: z.string() }).optional())
    .query(async ({ ctx, input }) => {
      // If no org specified, return projects across all user's orgs
      const orgFilter = input?.organizationId
        ? { organizationId: input.organizationId }
        : {
            organization: {
              members: { some: { userId: ctx.user.id } },
            },
          };

      return prisma.project.findMany({
        where: orgFilter,
        orderBy: { createdAt: "desc" },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          _count: {
            select: {
              events: true,
              pageViews: true,
              apiKeys: true,
              sessionRecordings: true,
            },
          },
        },
      });
    }),

  /** Get a single project by its id. */
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { project } = await requireProjectAccess(ctx.user.id, input.id);
      return prisma.project.findUnique({
        where: { id: project.id },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          _count: {
            select: {
              events: true,
              pageViews: true,
              apiKeys: true,
              sessionRecordings: true,
            },
          },
        },
      });
    }),

  /** Get a single project by (organizationId, slug). */
  bySlug: protectedProcedure
    .input(z.object({ organizationId: z.string(), slug: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireOrgMember(ctx.user.id, input.organizationId);
      return prisma.project.findUnique({
        where: {
          organizationId_slug: {
            organizationId: input.organizationId,
            slug: input.slug,
          },
        },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          _count: {
            select: {
              events: true,
              pageViews: true,
              apiKeys: true,
              sessionRecordings: true,
            },
          },
        },
      });
    }),

  /** Create a project inside an organization. Requires MEMBER+. */
  create: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().min(1).max(64),
        description: z.string().max(256).optional(),
        url: z.string().url().optional().or(z.literal("")),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOrgMember(ctx.user.id, input.organizationId, "MEMBER");
      const slug = slugify(input.name) + "-" + nanoid(6);
      return prisma.project.create({
        data: {
          name: input.name,
          slug,
          description: input.description ?? null,
          url: input.url || null,
          organizationId: input.organizationId,
        },
      });
    }),

  /** Update a project. Requires ADMIN+. */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(64).optional(),
        description: z.string().max(256).optional(),
        url: z.string().url().optional().or(z.literal("")),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.id, "ADMIN");
      return prisma.project.update({
        where: { id: input.id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.url !== undefined && { url: input.url || null }),
        },
      });
    }),

  /** Delete a project. Requires ADMIN+. */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.id, "ADMIN");
      await prisma.project.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // ─── API Keys ───────────────────────────────────────────────────────────────

  createApiKey: protectedProcedure
    .input(z.object({ projectId: z.string(), name: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId, "ADMIN");
      const raw = `clr_live_${nanoid(32)}`;
      return prisma.apiKey.create({
        data: {
          name: input.name,
          key: raw,
          prefix: "clr_live_",
          projectId: input.projectId,
        },
      });
    }),

  listApiKeys: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      return prisma.apiKey.findMany({
        where: { projectId: input.projectId, revokedAt: null },
        orderBy: { createdAt: "desc" },
      });
    }),

  revokeApiKey: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const key = await prisma.apiKey.findUnique({ where: { id: input.id } });
      if (!key) throw new TRPCError({ code: "NOT_FOUND" });
      await requireProjectAccess(ctx.user.id, key.projectId, "ADMIN");
      return prisma.apiKey.update({
        where: { id: input.id },
        data: { revokedAt: new Date() },
      });
    }),
});

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
