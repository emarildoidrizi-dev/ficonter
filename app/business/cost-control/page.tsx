import { redirect } from "next/navigation";
import { EncryptedBusinessCostControlWorkspace } from "@/components/EncryptedBusinessCostControlWorkspace";
import { getBusinessContext } from "@/lib/business/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessCostControlPage() {
  const { user, business } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/setup");

  return (
    <EncryptedBusinessCostControlWorkspace
      userId={user.id}
      business={business}
    />
  );
}
