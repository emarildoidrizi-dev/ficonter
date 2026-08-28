import { redirect } from "next/navigation";
import { EncryptedBusinessSuppliersWorkspace } from "@/components/EncryptedBusinessSuppliersWorkspace";
import { getBusinessContext } from "@/lib/business/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessSuppliersPage() {
  const { user, business } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/setup");

  return (
    <EncryptedBusinessSuppliersWorkspace
      userId={user.id}
      business={business}
    />
  );
}
