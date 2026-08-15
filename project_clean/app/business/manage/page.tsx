import { redirect } from "next/navigation";
import { BusinessManager } from "@/components/BusinessManager";
import { getBusinessContext } from "@/lib/business/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessManagePage() {
  const { user, businesses, business } = await getBusinessContext();
  if (!user) redirect("/login");

  return (
    <BusinessManager
      userId={user.id}
      initialBusinesses={businesses}
      activeBusinessId={business?.id ?? null}
    />
  );
}
