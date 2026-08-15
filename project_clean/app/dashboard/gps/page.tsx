import { redirect } from "next/navigation";

import { FinancialGps } from "@/components/FinancialGps";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";
import { normalizeAiInsightsInputs } from "@/lib/wealth/aiInsights";
import { readSetupAcknowledgements } from "@/lib/wealth/setupReadiness";

export const dynamic = "force-dynamic";

export const revalidate = 0;

export default async function FinancialGpsPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  await requireSubscriptionFeature("financial_gps");

  const { data, error } = await supabase.rpc(
    "get_ai_insights_inputs",
  );

  return (
    <FinancialGps
      userId={user.id}
      initialInputs={normalizeAiInsightsInputs(data)}
      initialAcknowledgements={readSetupAcknowledgements(
        user.user_metadata,
      )}
      initialError={error?.message ?? ""}
    />
  );
}
