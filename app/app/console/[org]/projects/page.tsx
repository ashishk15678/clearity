import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/dashboard/topbar";
import { ProjectsList } from "./projects-list";

export const metadata = { title: "Projects · Clarity" };

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: orgSlug } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

  // Resolve the real org DB id from the slug, and verify membership
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      organization: { slug: orgSlug },
    },
    include: { organization: true },
  });

  if (!membership) notFound();

  return (
    <div className="flex flex-col">
      <Topbar title="Projects" />
      <ProjectsList
        orgSlug={orgSlug}
        organizationId={membership.organization.id}
      />
    </div>
  );
}
