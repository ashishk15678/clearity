import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/dashboard/topbar";
import { ReportsView } from "./reports-view";
import { trpc, getQueryClient } from "@/trpc/server";

export const metadata = { title: "Reports · Clarity" };

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: orgSlug } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

  // org.membership is already prefetched by the layout — cache hit, no DB query.
  const qc = getQueryClient();
  const membership = await qc.fetchQuery(
    trpc.org.membership.queryOptions({ orgSlug }),
  );
  if (!membership) notFound();

  return (
    <div className="flex flex-col">
      <Topbar title="Reports" />
      <ReportsView organizationId={membership.organization.id} />
    </div>
  );
}
