import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/dashboard/topbar";
import { ProjectDetail } from "./project-detail";
import { requireOrgMember } from "@/lib/org-access";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ org: string; slug: string }>;
}) {
  const { org: orgSlug, slug } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

  // Resolve org from URL segment
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  const project = await prisma.project.findUnique({
    where: { organizationId_slug: { organizationId: org.id, slug } },
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

  if (!project) notFound();

  // Verify access
  try {
    await requireOrgMember(session.user.id, project.organizationId);
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-col">
      <Topbar title={project.name} id={project.slug} />
      <ProjectDetail project={project} />
    </div>
  );
}
