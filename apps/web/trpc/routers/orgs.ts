import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, type OrgRole } from "@/lib/org-access";
import { emitNotification } from "./notifications";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const OrgRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.organization.findMany({
      where: { members: { some: { userId: ctx.user.id } } },
      include: {
        members: { where: { userId: ctx.user.id }, select: { role: true } },
        _count: { select: { projects: true, members: true, teams: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  bySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await prisma.organization.findUnique({
        where: { slug: input.slug },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          teams: { include: { _count: { select: { members: true } } } },
          invites: {
            where: { acceptedAt: null, expiresAt: { gt: new Date() } },
          },
          _count: { select: { projects: true } },
        },
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });
      await requireOrgMember(ctx.user.id, org.id);
      return org;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(64),
        slug: z
          .string()
          .min(2)
          .max(48)
          .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only")
          .optional(),
        description: z.string().max(256).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = input.slug ?? slugify(input.name);
      const existing = await prisma.organization.findUnique({
        where: { slug },
      });
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Slug already taken",
        });

      return prisma.organization.create({
        data: {
          name: input.name,
          slug,
          description: input.description ?? null,
          ownerId: ctx.user.id,
          members: { create: { userId: ctx.user.id, role: "OWNER" } },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).max(64).optional(),
        description: z.string().max(256).optional(),
        url: z.string().url().optional().or(z.literal("")),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOrgMember(ctx.user.id, input.id, "ADMIN");
      return prisma.organization.update({
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

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgMember(ctx.user.id, input.id, "OWNER");
      await prisma.organization.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // ── Members ───────────────────────────────────────────────────────────────

  updateMemberRole: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        userId: z.string(),
        role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const caller = await requireOrgMember(
        ctx.user.id,
        input.organizationId,
        "ADMIN",
      );
      // Only OWNER can promote to OWNER or demote an OWNER
      if (input.role === "OWNER" && caller.role !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners can assign the OWNER role",
        });
      }
      const target = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
        },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (target.role === "OWNER" && caller.role !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot change the role of an owner",
        });
      }
      return prisma.organizationMember.update({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
        },
        data: { role: input.role },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ organizationId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const caller = await requireOrgMember(
        ctx.user.id,
        input.organizationId,
        "ADMIN",
      );
      if (input.userId === ctx.user.id) {
        // Self-leave — allowed unless last OWNER
        const ownerCount = await prisma.organizationMember.count({
          where: { organizationId: input.organizationId, role: "OWNER" },
        });
        if (ownerCount <= 1 && caller.role === "OWNER") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot leave — you are the last owner",
          });
        }
      } else {
        const target = await prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: input.organizationId,
              userId: input.userId,
            },
          },
        });
        if (target?.role === "OWNER" && caller.role !== "OWNER") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot remove an owner",
          });
        }
      }
      await prisma.organizationMember.delete({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
        },
      });
      return { success: true };
    }),

  // ── Invites ───────────────────────────────────────────────────────────────

  invite: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        email: z.string().email(),
        role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const caller = await requireOrgMember(
        ctx.user.id,
        input.organizationId,
        "ADMIN",
      );
      // Only OWNER can invite admins
      if (input.role === "ADMIN" && caller.role !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners can invite admins",
        });
      }

      // Check if email is already a member
      const existing = await prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        const alreadyMember = await prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: input.organizationId,
              userId: existing.id,
            },
          },
        });
        if (alreadyMember)
          throw new TRPCError({
            code: "CONFLICT",
            message: "User is already a member",
          });
      }

      // Upsert pending invite (replace if already pending for same email)
      await prisma.invite.deleteMany({
        where: {
          organizationId: input.organizationId,
          email: input.email,
          acceptedAt: null,
        },
      });

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const invite = await prisma.invite.create({
        data: {
          email: input.email,
          role: input.role,
          expiresAt,
          organizationId: input.organizationId,
          invitedById: ctx.user.id,
        },
        include: { organization: { select: { name: true, slug: true } } },
      });

      // TODO: send invite email — for now return the token so it can be shared
      // Notify the invited user if they already have an account
      if (existing) {
        await emitNotification(
          existing.id,
          "invite_received",
          `You've been invited to ${invite.organization.name}`,
          `${ctx.user.name ?? ctx.user.email} invited you as ${input.role}. Accept to join.`,
          `/invite/${invite.token}`,
        ).catch(() => {}); // non-fatal
      }
      return { invite, inviteUrl: `/invite/${invite.token}` };
    }),

  revokeInvite: protectedProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await prisma.invite.findUnique({
        where: { id: input.inviteId },
      });
      if (!invite) throw new TRPCError({ code: "NOT_FOUND" });
      await requireOrgMember(ctx.user.id, invite.organizationId, "ADMIN");
      await prisma.invite.delete({ where: { id: input.inviteId } });
      return { success: true };
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await prisma.invite.findUnique({
        where: { token: input.token },
        include: { organization: true },
      });
      if (!invite)
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      if (invite.acceptedAt)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invite already used",
        });
      if (invite.expiresAt < new Date())
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite expired" });

      const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
      if (user?.email !== invite.email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invite is for a different email address",
        });
      }

      // Add as member (or update role if already a member somehow)
      await prisma.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: invite.organizationId,
            userId: ctx.user.id,
          },
        },
        create: {
          organizationId: invite.organizationId,
          userId: ctx.user.id,
          role: invite.role,
        },
        update: {},
      });

      await prisma.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      // Notify org admins that someone joined
      const admins = await prisma.organizationMember.findMany({
        where: {
          organizationId: invite.organizationId,
          role: { in: ["OWNER", "ADMIN"] },
          NOT: { userId: ctx.user.id },
        },
        select: { userId: true },
      });
      const joinerName = user?.name ?? user?.email ?? "Someone";
      await Promise.all(
        admins.map((a) =>
          emitNotification(
            a.userId,
            "member_joined",
            `${joinerName} joined ${invite.organization.name}`,
            `${joinerName} accepted their invite and joined as ${invite.role}.`,
            `/console/${invite.organization.slug}/teams`,
          ).catch(() => {}),
        ),
      );

      return { organization: invite.organization };
    }),

  listInvites: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireOrgMember(ctx.user.id, input.organizationId, "ADMIN");
      return prisma.invite.findMany({
        where: { organizationId: input.organizationId, acceptedAt: null },
        include: { invitedBy: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  // ── Teams ─────────────────────────────────────────────────────────────────

  createTeam: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().min(1).max(64),
        description: z.string().max(256).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOrgMember(ctx.user.id, input.organizationId, "ADMIN");
      return prisma.team.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          organizationId: input.organizationId,
        },
      });
    }),

  updateTeam: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        name: z.string().min(1).max(64).optional(),
        description: z.string().max(256).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await prisma.team.findUnique({
        where: { id: input.teamId },
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      await requireOrgMember(ctx.user.id, team.organizationId, "ADMIN");
      return prisma.team.update({
        where: { id: input.teamId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
        },
      });
    }),

  deleteTeam: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await prisma.team.findUnique({
        where: { id: input.teamId },
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      await requireOrgMember(ctx.user.id, team.organizationId, "ADMIN");
      await prisma.team.delete({ where: { id: input.teamId } });
      return { success: true };
    }),

  listTeams: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireOrgMember(ctx.user.id, input.organizationId);
      return prisma.team.findMany({
        where: { organizationId: input.organizationId },
        include: {
          members: {
            include: {
              member: {
                include: {
                  user: {
                    select: { id: true, name: true, email: true, image: true },
                  },
                },
              },
            },
          },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  addTeamMember: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        userId: z.string(),
        role: z.enum(["LEAD", "MEMBER"]).default("MEMBER"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await prisma.team.findUnique({
        where: { id: input.teamId },
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      await requireOrgMember(ctx.user.id, team.organizationId, "ADMIN");

      const orgMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: team.organizationId,
            userId: input.userId,
          },
        },
      });
      if (!orgMember)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User is not an org member",
        });

      return prisma.teamMember.upsert({
        where: {
          teamId_memberId: { teamId: input.teamId, memberId: orgMember.id },
        },
        create: {
          teamId: input.teamId,
          memberId: orgMember.id,
          role: input.role,
        },
        update: { role: input.role },
      });
    }),

  removeTeamMember: protectedProcedure
    .input(z.object({ teamId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await prisma.team.findUnique({
        where: { id: input.teamId },
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      await requireOrgMember(ctx.user.id, team.organizationId, "ADMIN");

      const orgMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: team.organizationId,
            userId: input.userId,
          },
        },
      });
      if (!orgMember) throw new TRPCError({ code: "NOT_FOUND" });

      await prisma.teamMember.delete({
        where: {
          teamId_memberId: { teamId: input.teamId, memberId: orgMember.id },
        },
      });
      return { success: true };
    }),

  // ── Team project access ───────────────────────────────────────────────────

  /** Set (upsert) the access level a team has on a project. access=null removes it. */
  setTeamProjectAccess: protectedProcedure
    .input(
      z.object({
        teamId:    z.string(),
        projectId: z.string(),
        access:    z.enum(["VIEWER", "MEMBER", "ADMIN"]).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await prisma.team.findUnique({ where: { id: input.teamId } });
      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      await requireOrgMember(ctx.user.id, team.organizationId, "ADMIN");

      if (input.access === null) {
        await prisma.teamProjectAccess.deleteMany({
          where: { teamId: input.teamId, projectId: input.projectId },
        });
        return { success: true };
      }

      return prisma.teamProjectAccess.upsert({
        where: { teamId_projectId: { teamId: input.teamId, projectId: input.projectId } },
        create: { teamId: input.teamId, projectId: input.projectId, access: input.access },
        update: { access: input.access },
      });
    }),

  /** List all project-access grants for a team. */
  listTeamProjectAccess: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      const team = await prisma.team.findUnique({ where: { id: input.teamId } });
      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      await requireOrgMember(ctx.user.id, team.organizationId);
      return prisma.teamProjectAccess.findMany({
        where: { teamId: input.teamId },
        include: { project: { select: { id: true, name: true, slug: true } } },
        orderBy: { grantedAt: "asc" },
      });
    }),
});
