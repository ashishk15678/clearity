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

/** Returns the project + membership, throws if not found or insufficient access. */
export async function requireProjectAccess(
  userId: string,
  projectId: string,
  minRole: OrgRole = "VIEWER",
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new TRPCError({ code: "NOT_FOUND" });
  const membership = await requireOrgMember(
    userId,
    project.organizationId,
    minRole,
  );
  return { project, membership };
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
