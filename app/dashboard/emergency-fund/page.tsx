import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { EncryptedEmergencyFundWorkspace } from "@/components/EncryptedEmergencyFundWorkspace";

import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EmergencyFundPage() {
  await requireSubscriptionFeature("emergency_fund_intelligence");
  const { user } = await getCurrentUser();

  if (!user) redirect("/login");

  return <EncryptedEmergencyFundWorkspace userId={user.id} />;
}
