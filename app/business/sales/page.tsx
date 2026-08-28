import { redirect } from "next/navigation";
import { EncryptedBusinessSalesWorkspace } from "@/components/EncryptedBusinessSalesWorkspace";
import { getBusinessContext } from "@/lib/business/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessSalesPage() {
  const { user, business } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/setup");

  return <EncryptedBusinessSalesWorkspace business={business} />;
}
