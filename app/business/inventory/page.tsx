import { redirect } from "next/navigation";
import { EncryptedBusinessInventoryWorkspace } from "@/components/EncryptedBusinessInventoryWorkspace";
import { getBusinessContext } from "@/lib/business/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessInventoryPage() {
  const { user, business } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/setup");

  return <EncryptedBusinessInventoryWorkspace business={business} />;
}
