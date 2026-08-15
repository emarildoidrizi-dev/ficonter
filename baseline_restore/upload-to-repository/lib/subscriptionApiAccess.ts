import "server-only";

import { NextResponse } from "next/server";

import { getCurrentSubscriptionFeatureAccess } from "@/lib/subscriptionAccess";
import { getRequiredPlanDetails } from "@/lib/subscriptionNavigation";
import type { SubscriptionFeature } from "@/lib/subscriptionPlans";

export async function subscriptionApiAccessError(
  feature: SubscriptionFeature,
) {
  const access = await getCurrentSubscriptionFeatureAccess(feature);

  if (access.allowed) {
    return null;
  }

  if (access.reason === "unauthenticated") {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const requiredPlan = getRequiredPlanDetails(feature);

  return NextResponse.json(
    {
      error:
        requiredPlan.code === null
          ? "This Ficonter feature is not available yet."
          : `${requiredPlan.name} is required to use this feature.`,
      code:
        access.reason === "not_released"
          ? "feature_not_released"
          : "subscription_upgrade_required",
      requiredPlan: requiredPlan.code,
    },
    { status: 403, headers: { "Cache-Control": "private, no-store" } },
  );
}
