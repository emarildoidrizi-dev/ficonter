import { redirect } from "next/navigation";
import { EncryptedAiInsightsWorkspace } from "@/components/EncryptedAiInsightsWorkspace";
import { getCurrentUser } from "@/lib/auth/currentUser";

import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SmartInsightsPage() {
  await requireSubscriptionFeature("smart_insights");
  const { user } = await getCurrentUser();

  if (!user) redirect("/login");

  return <EncryptedAiInsightsWorkspace userId={user.id} />;
}
