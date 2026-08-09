import "server-only";

import { cache } from "react";

import { requireAdmin } from "@/lib/admin/access";
import { getCurrentUser } from "@/lib/auth/currentUser";

import {
  hasSubscriptionFeature,
  isSubscriptionAccessActive,
  type SubscriptionFeature,
  type SubscriptionPlanCode,
  type SubscriptionStatus,
} from "@/lib/subscriptionPlans";

function isValidPlan(value: unknown): value is SubscriptionPlanCode {
  return (
    value === "beta" ||
    value === "free" ||
    value === "personal_pro" ||
    value === "business_pro"
  );
}

function isValidStatus(value: unknown): value is SubscriptionStatus {
  return (
    value === "trialing" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "unpaid"
  );
}

export const getCurrentSubscriptionAccess = cache(async () => {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return {
      authenticated: false,
      isAdminExempt: false,
      adminRole: null,
      planCode: "free" as SubscriptionPlanCode,
      status: "unpaid" as SubscriptionStatus,
    };
  }

  /*
   * Owner / Super Admin / Admin subscription exemption.
   */
  const { admin } = await requireAdmin();

  if (admin) {
    return {
      authenticated: true,
      isAdminExempt: true,
      adminRole: admin.role,
      planCode: "business_pro" as SubscriptionPlanCode,
      status: "active" as SubscriptionStatus,
    };
  }

  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("plan_code, status")
    .eq("user_id", user.id)
    .maybeSingle();

  /*
   * Normal customers fail closed.
   * Missing, invalid or unreadable subscription data
   * must never unlock paid features.
   */
  if (
    error ||
    !subscription ||
    !isValidPlan(subscription.plan_code) ||
    !isValidStatus(subscription.status)
  ) {
    return {
      authenticated: true,
      isAdminExempt: false,
      adminRole: null,
      planCode: "free" as SubscriptionPlanCode,
      status: "unpaid" as SubscriptionStatus,
    };
  }

  return {
    authenticated: true,
    isAdminExempt: false,
    adminRole: null,
    planCode: subscription.plan_code,
    status: subscription.status,
  };
});

export async function canCurrentUserAccessSubscriptionFeature(
  feature: SubscriptionFeature,
) {
  const access = await getCurrentSubscriptionAccess();

  if (!access.authenticated) {
    return false;
  }

  if (access.isAdminExempt) {
    return true;
  }

  return (
    isSubscriptionAccessActive(access.status) &&
    hasSubscriptionFeature(access.planCode, feature)
  );
}
