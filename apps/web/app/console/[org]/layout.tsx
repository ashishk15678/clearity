import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { trpc, HydrateClient, getQueryClient } from "@/trpc/server";

export default async function ConsoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { org: orgSlug } = await params;

  // Verify membership via tRPC — this is the single source of truth for the
  // auth guard. No direct Prisma call needed here anymore.
  const qc = getQueryClient();
  const membership = await qc.fetchQuery(
    trpc.org.membership.queryOptions({ orgSlug }),
  );
  if (!membership) notFound();

  // Prefetch shell data in parallel — these are needed on every console page.
  // org.list        → OrgSwitcher (topbar)
  // unreadCount     → NotificationBell (topbar)
  // org.membership  → already fetched above; fetchQuery populates the cache
  // orgOverview is NOT prefetched here — it's only used on the overview page
  // and would wastefully run 5 DB queries on every other console route.
  await Promise.all([
    qc.prefetchQuery(trpc.org.list.queryOptions()),
    qc.prefetchQuery(trpc.notifications.unreadCount.queryOptions()),
  ]);

  return (
    <HydrateClient>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar orgSlug={orgSlug} />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <main className="flex-1 overflow-y-auto bg-background">{children}</main>
        </div>
      </div>
    </HydrateClient>
  );
}
