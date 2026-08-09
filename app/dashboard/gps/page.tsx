import { redirect } from "next/navigation";

import { FinancialGps } from "@/components/FinancialGps";

import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  hasSubscriptionFeature,
  isSubscriptionAccessActive,
  normalizeSubscriptionPlan,
  normalizeSubscriptionStatus,
} from "@/lib/subscriptionPlans";
import { normalizeAiInsightsInputs } from "@/lib/wealth/aiInsights";
import { readSetupAcknowledgements } from "@/lib/wealth/setupReadiness";

export const dynamic = "force-dynamic";

export const revalidate = 0;

export default async function FinancialGpsPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const {
    data: subscription,
    error: subscriptionError,
  } = await supabase
    .from("subscriptions")
    .select("plan_code, status")
    .eq("user_id", user.id)
    .maybeSingle();

  /*
   * Fail closed:
   * if the subscription cannot be verified,
   * do not expose a paid feature.
   */
  if (subscriptionError) {
    redirect(
      "/dashboard/settings?section=subscription&required=financial_gps",
    );
  }

  const planCode = subscription
    ? normalizeSubscriptionPlan(subscription.plan_code)
    : "free";

  const subscriptionStatus = subscription
    ? normalizeSubscriptionStatus(subscription.status)
    : "active";

  const canUseFinancialGps =
    isSubscriptionAccessActive(subscriptionStatus) &&
    hasSubscriptionFeature(planCode, "financial_gps");

  if (!canUseFinancialGps) {
    redirect(
      "/dashboard/settings?section=subscription&required=financial_gps",
    );
  }

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
