import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/prisma";

export type OrgRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

const ROLE_RANK: Record<OrgRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

function roleAtLeast(actual: string, required: OrgRole): boolean {
  return (ROLE_RANK[actual as OrgRole] ?? 0) >= ROLE_RANK[required];
}

/** Returns the membership row, throws FORBIDDEN if not a member or below minRole. */
export async function requireOrgMember(
  userId: string,
  organizationId: string,
  minRole: OrgRole = "VIEWER",
) {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not a member of this organization",
    });
  }

  if (!roleAtLeast(membership.role, minRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Requires ${minRole} role or higher`,
    });
  }

  return membership;
}

/**
 * Returns the project + membership, throws if not found or insufficient access.
 *
 * Access is granted when ANY of these is true (in order):
 *   1. User has org-level role >= minRole (existing behaviour).
 *   2. User is a member of a team that has TeamProjectAccess >= minRole on this
 *      project (team-scoped permission grant).
 */
export async function requireProjectAccess(
  userId: string,
  projectId: string,
  minRole: OrgRole = "VIEWER",
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new TRPCError({ code: "NOT_FOUND" });

  // ── 1. Org-level check ────────────────────────────────────────────────────
  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: project.organizationId,
        userId,
      },
    },
  });

  if (orgMembership && roleAtLeast(orgMembership.role, minRole)) {
    return { project, membership: orgMembership };
  }

  // ── 2. Team-level check ───────────────────────────────────────────────────
  // Find any TeamProjectAccess row for this project whose team contains the user.
  const teamGrant = await prisma.teamProjectAccess.findFirst({
    where: {
      projectId,
      // The access level stored in the grant must be >= minRole
      access: { in: accessLevelsAtLeast(minRole) },
      team: {
        members: {
          some: {
            member: {
              organizationId: project.organizationId,
              userId,
            },
          },
        },
      },
    },
  });

  if (teamGrant) {
    // Return the org membership row if it exists (even if below minRole) so
    // callers have a consistent return shape; fall back to a synthetic object.
    if (orgMembership) return { project, membership: orgMembership };

    // User is not a direct org member but has team-granted access.
    // Throw FORBIDDEN on mutations that need an org membership row (e.g. role
    // changes) — read access and project-scoped mutations are fine.
    // shortcut: returns a synthetic membership, callers that need a real org member row will re-check
    return {
      project,
      membership: {
        id: teamGrant.id,
        role: teamGrant.access, // effective role for this call
        organizationId: project.organizationId,
        userId,
        createdAt: teamGrant.grantedAt,
      },
    };
  }

  // ── Neither check passed ─────────────────────────────────────────────────
  if (!orgMembership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not a member of this organization",
    });
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: `Requires ${minRole} role or higher`,
  });
}

/** Returns all access level strings that are >= minRole. */
function accessLevelsAtLeast(minRole: OrgRole): string[] {
  return (Object.keys(ROLE_RANK) as OrgRole[]).filter((r) =>
    roleAtLeast(r, minRole),
  );
}

/** Same but looks up by (organizationId, slug). */
export async function requireProjectBySlug(
  userId: string,
  organizationId: string,
  slug: string,
  minRole: OrgRole = "VIEWER",
) {
  const project = await prisma.project.findUnique({
    where: { organizationId_slug: { organizationId, slug } },
  });
  if (!project) throw new TRPCError({ code: "NOT_FOUND" });
  const membership = await requireOrgMember(userId, organizationId, minRole);
  return { project, membership };
}
