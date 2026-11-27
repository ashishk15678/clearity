import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/dashboard/topbar";
import { ProjectsList } from "./projects-list";
import { trpc, getQueryClient } from "@/trpc/server";

export const metadata = { title: "Projects · Clarity" };

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: orgSlug } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

  // org.membership is already prefetched by the layout — this is a cache hit.
  const qc = getQueryClient();
  const membership = await qc.fetchQuery(
    trpc.org.membership.queryOptions({ orgSlug }),
  );
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
