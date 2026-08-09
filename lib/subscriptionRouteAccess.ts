import "server-only";

import { redirect } from "next/navigation";

import { getCurrentSubscriptionFeatureAccess } from "@/lib/subscriptionAccess";
import { getSubscriptionUpgradeHref } from "@/lib/subscriptionNavigation";
import type { SubscriptionFeature } from "@/lib/subscriptionPlans";

export async function requireSubscriptionFeature(
  feature: SubscriptionFeature,
) {
  const access = await getCurrentSubscriptionFeatureAccess(feature);

  if (access.allowed) {
    return access;
  }

  if (access.reason === "unauthenticated") {
    redirect("/login");
  }

  redirect(getSubscriptionUpgradeHref(feature));
}
