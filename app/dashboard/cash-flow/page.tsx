import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { EncryptedCashFlowWorkspace } from "@/components/EncryptedCashFlowWorkspace";

import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CashFlowPage() {
  await requireSubscriptionFeature("cash_flow_intelligence");
  const { user } = await getCurrentUser();

  if (!user) redirect("/login");

  return <EncryptedCashFlowWorkspace userId={user.id} />;
}
