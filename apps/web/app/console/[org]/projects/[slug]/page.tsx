import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { TRPCError } from "@trpc/server";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/dashboard/topbar";
import { ProjectDetail } from "./project-detail";
import { trpc, getQueryClient } from "@/trpc/server";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ org: string; slug: string }>;
}) {
  // 1. Await params (required in Next.js 15+)
  const { org: orgSlug, slug } = await params;

  // 2. Verify session
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) notFound();

  // 3. Fetch directly on the server using TanStack QueryClient + tRPC v11 queryOptions
  const queryClient = getQueryClient();
  let project;

  try {
    project = await queryClient.fetchQuery(
      trpc.projects.bySlug.queryOptions({
        orgSlug,
        slug,
      }),
    );
  } catch (error) {
    if (error instanceof TRPCError) {
      notFound();
    }
    throw error;
  }

  if (!project) notFound();

  return (
    <div className="flex flex-col">
      <Topbar title={project.name} id={project.slug} />
      <ProjectDetail project={project} />
    </div>
  );
}
