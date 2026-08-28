import { redirect } from "next/navigation";

import { EncryptedFinancialGpsWorkspace } from "@/components/EncryptedFinancialGpsWorkspace";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";
import { readSetupAcknowledgements } from "@/lib/wealth/setupReadiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FinancialGpsPage() {
  const { user } = await getCurrentUser();

  if (!user) redirect("/login");

  await requireSubscriptionFeature("financial_gps");

  return (
    <EncryptedFinancialGpsWorkspace
      userId={user.id}
      initialAcknowledgements={readSetupAcknowledgements(user.user_metadata)}
    />
  );
}
