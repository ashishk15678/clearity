import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/dashboard/topbar";
import { ReportsView } from "./reports-view";

export const metadata = { title: "Reports · Clarity" };

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: orgSlug } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

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
      <Topbar title="Reports" />
      <ReportsView organizationId={membership.organization.id} />
    </div>
  );
}
