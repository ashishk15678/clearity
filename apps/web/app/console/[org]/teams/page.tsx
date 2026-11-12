import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/dashboard/topbar";
import { TeamsView } from "./teams-view";

export const metadata = { title: "Teams · Clarity" };

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: orgSlug } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      organization: { slug: orgSlug },
    },
    include: {
      organization: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          teams: {
            include: {
              members: {
                include: {
                  member: {
                    include: {
                      user: { select: { id: true, name: true, email: true } },
                    },
                  },
                },
              },
              _count: { select: { members: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          invites: {
            where: { acceptedAt: null, expiresAt: { gt: new Date() } },
            include: { invitedBy: { select: { name: true, email: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) notFound();

  return (
    <div className="flex flex-col">
      <Topbar title="Teams" />
      <TeamsView
        org={membership.organization}
        myMembership={{
          id: membership.id,
          role: membership.role,
          userId: session.user.id,
        }}
        currentUserId={session.user.id}
      />
    </div>
  );
}
