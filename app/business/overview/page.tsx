import { redirect } from "next/navigation";
import { EncryptedBusinessOverviewWorkspace } from "@/components/EncryptedBusinessOverviewWorkspace";
import { getBusinessContext } from "@/lib/business/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessOverviewPage() {
  const { user, business } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/setup");

  return <EncryptedBusinessOverviewWorkspace business={business} />;
}
