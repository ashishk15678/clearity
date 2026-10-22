import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrgCreateModal } from "@/components/org-create-modal";

export default async function ConsolePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // Find first org the user belongs to
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (membership) {
    redirect(`/console/${membership.organization.slug}`);
  }

  // No org → show create-org modal (full-page)
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <OrgCreateModal />
    </div>
  );
}
