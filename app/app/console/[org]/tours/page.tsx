import { Topbar } from "@/components/dashboard/topbar";
import { TourBuilder } from "./tour-builder";

export const metadata = { title: "Tours · Clarity" };

export default async function ToursPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: orgSlug } = await params;
  return (
    <div className="flex flex-col">
      <Topbar title="Tours" />
      <TourBuilder orgSlug={orgSlug} />
    </div>
  );
}
