import { redirect } from "next/navigation";
import { BusinessSetup } from "@/components/BusinessSetup";
import { getBusinessContext } from "@/lib/business/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessSetupPage() {
  const { user, businesses, business } = await getBusinessContext();

  if (!user) redirect("/login");
  if (business) redirect("/business/overview");
  if (businesses.length) redirect("/business/manage");

  return <BusinessSetup />;
}
