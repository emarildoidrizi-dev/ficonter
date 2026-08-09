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

function isValidPlan(
  value: unknown,
): value is SubscriptionPlanCode {
  return (
    value === "beta" ||
    value === "free" ||
    value === "personal_pro" ||
    value === "business_pro"
  );
}

function isValidStatus(
  value: unknown,
): value is SubscriptionStatus {
  return (
    value === "trialing" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "unpaid"
  );
}

function hasCancellationGraceAccess(
  status: SubscriptionStatus,
  cancelAtPeriodEnd: boolean,
  currentPeriodEnd: string | null,
) {
  if (
    status !== "canceled" ||
    !cancelAtPeriodEnd ||
    !currentPeriodEnd
  ) {
    return false;
  }

  const paidThrough = Date.parse(currentPeriodEnd);

  return (
    Number.isFinite(paidThrough) &&
    paidThrough > Date.now()
  );
}

export const getCurrentSubscriptionAccess = cache(
  async () => {
    const { supabase, user } = await getCurrentUser();

    if (!user) {
      return {
        authenticated: false,
        isAdminExempt: false,
        adminRole: null,
        planCode: "free" as SubscriptionPlanCode,
        status: "unpaid" as SubscriptionStatus,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null as string | null,
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
        planCode:
          "business_pro" as SubscriptionPlanCode,
        status: "active" as SubscriptionStatus,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null as string | null,
      };
    }

    const {
      data: subscription,
      error,
    } = await supabase
      .from("subscriptions")
      .select(
        "plan_code,status,cancel_at_period_end,current_period_end",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    /*
     * Normal customers fail closed.
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
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null as string | null,
      };
    }

    return {
      authenticated: true,
      isAdminExempt: false,
      adminRole: null,
      planCode: subscription.plan_code,
      status: subscription.status,
      cancelAtPeriodEnd:
        subscription.cancel_at_period_end === true,
      currentPeriodEnd:
        typeof subscription.current_period_end ===
        "string"
          ? subscription.current_period_end
          : null,
    };
  },
);

export async function canCurrentUserAccessSubscriptionFeature(
  feature: SubscriptionFeature,
) {
  const access =
    await getCurrentSubscriptionAccess();

  if (!access.authenticated) {
    return false;
  }

  if (access.isAdminExempt) {
    return true;
  }

  const subscriptionIsUsable =
    isSubscriptionAccessActive(access.status) ||
    hasCancellationGraceAccess(
      access.status,
      access.cancelAtPeriodEnd,
      access.currentPeriodEnd,
    );

  return (
    subscriptionIsUsable &&
    hasSubscriptionFeature(
      access.planCode,
      feature,
    )
  );
}
