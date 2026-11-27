import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/dashboard/topbar";
import { TeamsView } from "./teams-view";
import { trpc, getQueryClient, HydrateClient } from "@/trpc/server";

export const metadata = { title: "Teams · Clarity" };

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: orgSlug } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const qc = getQueryClient();

  // Both are prefetched by the layout — cache hits, zero DB queries here.
  const membership = await qc.fetchQuery(
    trpc.org.membership.queryOptions({ orgSlug }),
  );
  if (!membership) notFound();

  // Prefetch the full org (members + teams + invites) for TeamsView.
  // TeamsView's mutations already invalidate trpc.org.bySlug so the cache
  // stays consistent after role changes, team creates, etc.
  await qc.prefetchQuery(trpc.org.bySlug.queryOptions({ slug: orgSlug }));

  const org = await qc.fetchQuery(
    trpc.org.bySlug.queryOptions({ slug: orgSlug }),
  );
  if (!org) notFound();

  return (
    <HydrateClient>
      <div className="flex flex-col">
        <Topbar title="Teams" />
        <TeamsView
          org={org}
          myMembership={{
            id: membership.id,
            role: membership.role,
            userId: session.user.id,
          }}
          currentUserId={session.user.id}
        />
      </div>
    </HydrateClient>
  );
}
