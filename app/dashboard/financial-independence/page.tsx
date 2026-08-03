import { redirect } from "next/navigation";
import { FinancialIndependence } from "@/components/FinancialIndependence";
import { getCurrentUser } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FinancialIndependencePage() {
  const { user } = await getCurrentUser();
  if (!user) redirect("/login");

  return <FinancialIndependence userId={user.id} />;
}
