import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { nanoid } from "@/lib/nanoid";
import { createHash, createHmac, randomUUID } from "crypto";
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
    .input(z.object({ orgSlug: z.string(), slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await prisma.organization.findUniqueOrThrow({
        where: { slug: input.orgSlug },
      });
      await requireOrgMember(ctx.user.id, org.id);
      return prisma.project.findUnique({
        where: {
          organizationId_slug: {
            organizationId: org.id,
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

      // ── Token design ────────────────────────────────────────────────────────
      // Token: clr.<keyId>.<hmac_sha256(secretHash, projectId)>
      //
      // keyId      — 8-char unique ID embedded in the token so ingest can do
      //              a single PK lookup (no full-table scan on the token itself)
      // secretHash — SHA-256(rawSecret) stored in DB, never transmitted again
      // projectId  — the HMAC message, binding the token to exactly one project
      //
      // The token is static (browser SDKs can't recompute HMAC without the
      // secret, and putting the secret in the browser defeats the purpose).
      // Security comes from the token being unguessable without secretHash.
      // Revocation is instant via revokedAt — no replay window needed.
      //
      // On ingest: parse keyId → one indexed PK lookup → recompute HMAC with
      // stored secretHash → constant-time compare. Cache (keyId, projectId)
      // for 5 min so repeated SDK calls don't hit the DB every time.

      const keyId = nanoid(8);
      const rawSecret = nanoid(40);
      const secretHash = createHash("sha256").update(rawSecret).digest("hex");
      const mac = createHmac("sha256", secretHash).update(input.projectId).digest("hex");
      const token = `clr.${keyId}.${mac}`;
      const prefix = `clr.${keyId}`;

      await prisma.$executeRaw`
        INSERT INTO api_key (id, name, "keyId", "secretHash", prefix, "projectId", "createdAt")
        VALUES (
          ${randomUUID()},
          ${input.name},
          ${keyId},
          ${secretHash},
          ${prefix},
          ${input.projectId},
          NOW()
        )
      `;

      // token is returned once and never stored — the DB only holds secretHash
      return { keyId, token, prefix };
    }),

  listApiKeys: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.user.id, input.projectId);
      // Use raw query since schema is ahead of generated client
      const rows = await prisma.$queryRaw<{
        id: string;
        name: string;
        keyId: string;
        prefix: string;
        lastUsedAt: Date | null;
        createdAt: Date;
      }[]>`
        SELECT id, name, "keyId", prefix, "lastUsedAt", "createdAt"
        FROM api_key
        WHERE "projectId" = ${input.projectId}
          AND "revokedAt" IS NULL
        ORDER BY "createdAt" DESC
      `;
      return rows;
    }),

  revokeApiKey: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await prisma.$queryRaw<{ projectId: string }[]>`
        SELECT "projectId" FROM api_key WHERE id = ${input.id} LIMIT 1
      `;
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND" });
      await requireProjectAccess(ctx.user.id, rows[0]!.projectId, "ADMIN");
      await prisma.$executeRaw`
        UPDATE api_key SET "revokedAt" = NOW() WHERE id = ${input.id}
      `;
      return { success: true };
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
