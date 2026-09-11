import "server-only";

import { cache } from "react";

import { requireAdmin } from "@/lib/admin/access";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { hasFiconterBetaFreeSession, isFiconterBetaEntryEnvironment } from "@/lib/betaDomainGate";
import { createServiceClient } from "@/lib/supabase/admin";

import {
  getRequiredSubscriptionPlan,
  hasSubscriptionFeature,
  isSubscriptionAccessActive,
  isSubscriptionFeatureReleased,
  type PublicSubscriptionPlanCode,
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

function isPaidPlan(
  value: SubscriptionPlanCode,
): value is "personal_pro" | "business_pro" {
  return value === "personal_pro" || value === "business_pro";
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

function cancellationPeriodHasExpired(
  cancelAtPeriodEnd: boolean,
  currentPeriodEnd: string | null,
) {
  if (!cancelAtPeriodEnd || !currentPeriodEnd) {
    return false;
  }

  const paidThrough = Date.parse(currentPeriodEnd);

  return Number.isFinite(paidThrough) && paidThrough <= Date.now();
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

async function persistFreeDowngrade(userId: string) {
  const service = createServiceClient();

  const { error } = await service
    .from("subscriptions")
    .update({
      plan_code: "free",
      status: "active",
      billing_interval: null,
      provider: "internal",
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
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
        betaVerified: false,
      };
    }

    /*
     * Owner / Super Admin / Admin subscription exemption.
     * This is role-based and never tied to a customer email.
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
        betaVerified: true,
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
     * Normal customers fail closed to the Free entitlement tier.
     * A missing/invalid subscription row must never grant paid access.
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
        betaVerified: false,
      };
    }

    const cancelAtPeriodEnd = subscription.cancel_at_period_end === true;
    const currentPeriodEnd =
      typeof subscription.current_period_end === "string"
        ? subscription.current_period_end
        : null;

    /*
     * ABSOLUTE EXPIRY RULE:
     * A paid subscription that was canceled at period end stops being a paid
     * plan the instant its paid-through timestamp is reached. This check is
     * independent of the stored PayPal status, so a delayed webhook or stale
     * `active` status can never keep Personal Pro / Business Pro entitlements
     * alive beyond current_period_end.
     *
     * Persist the account back to the normal Free row when possible, but fail
     * closed to Free even if that persistence write is temporarily unavailable.
     */
    if (
      isPaidPlan(subscription.plan_code) &&
      cancellationPeriodHasExpired(cancelAtPeriodEnd, currentPeriodEnd)
    ) {
      try {
        await persistFreeDowngrade(user.id);
      } catch (downgradeError) {
        console.error(
          "Unable to persist expired subscription downgrade:",
          downgradeError,
        );
      }

      return {
        authenticated: true,
        isAdminExempt: false,
        adminRole: null,
        planCode: "free" as SubscriptionPlanCode,
        status: "active" as SubscriptionStatus,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null as string | null,
        betaVerified: false,
      };
    }

    let betaVerified = false;

    if (subscription.plan_code === "beta") {
      try {
        const service = createServiceClient();
        const { data: verifiedBeta, error: betaError } = await service
          .from("beta_user_entitlements")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (betaError || !verifiedBeta) {
          // HARD FAIL-CLOSED RULE FOR NORMAL CUSTOMERS:
          // a legacy/unverified Beta plan is not merely hidden in the UI; it is
          // persisted back to Free. Admin roles never reach this branch because
          // they are exempt above before subscription rows are evaluated.
          await service
            .from("subscriptions")
            .update({
              plan_code: "free",
              status: "active",
              billing_interval: null,
              provider: "internal",
              current_period_start: null,
              current_period_end: null,
              cancel_at_period_end: false,
            })
            .eq("user_id", user.id);

          return {
            authenticated: true,
            isAdminExempt: false,
            adminRole: null,
            planCode: "free" as SubscriptionPlanCode,
            status: "active" as SubscriptionStatus,
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null as string | null,
            betaVerified: false,
          };
        }

        betaVerified = true;
      } catch {
        return {
          authenticated: true,
          isAdminExempt: false,
          adminRole: null,
          planCode: "free" as SubscriptionPlanCode,
          status: "active" as SubscriptionStatus,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null as string | null,
          betaVerified: false,
        };
      }

      /*
       * The explicit "Continue with Free plan" choice is only allowed to
       * session-downgrade a verified Beta account. It must NEVER override an
       * active/trialing Personal Pro or Business Pro subscription, including a
       * paid subscription that is scheduled to cancel at period end. Paid
       * customer entitlements remain authoritative until they actually expire.
       */
      if (
        (await isFiconterBetaEntryEnvironment()) &&
        (await hasFiconterBetaFreeSession())
      ) {
        return {
          authenticated: true,
          isAdminExempt: false,
          adminRole: null,
          planCode: "free" as SubscriptionPlanCode,
          status: "active" as SubscriptionStatus,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null as string | null,
          betaVerified: false,
        };
      }
    }

    return {
      authenticated: true,
      isAdminExempt: false,
      adminRole: null,
      planCode: subscription.plan_code,
      status: subscription.status,
      cancelAtPeriodEnd,
      currentPeriodEnd,
      betaVerified,
    };
  },
);

type SubscriptionAccessSnapshot =
  Awaited<ReturnType<typeof getCurrentSubscriptionAccess>>;

function paidSubscriptionIsUsable(
  access: SubscriptionAccessSnapshot,
) {
  if (
    cancellationPeriodHasExpired(
      access.cancelAtPeriodEnd,
      access.currentPeriodEnd,
    )
  ) {
    return false;
  }

  return (
    isSubscriptionAccessActive(access.status) ||
    hasCancellationGraceAccess(
      access.status,
      access.cancelAtPeriodEnd,
      access.currentPeriodEnd,
    )
  );
}

/**
 * A customer never loses the Free tier because a paid subscription is
 * past-due, canceled, unpaid, missing or invalid.
 *
 * Active/trialing paid plans use their paid tier until current_period_end when
 * renewal has been canceled. At that exact timestamp the effective plan is
 * Free even if a provider webhook has not yet changed the stored status.
 * Admin roles remain exempt.
 */
export function getEffectiveSubscriptionPlanCode(
  access: SubscriptionAccessSnapshot,
): SubscriptionPlanCode {
  if (access.isAdminExempt) {
    return "business_pro";
  }

  if (access.planCode === "free") {
    return "free";
  }

  return paidSubscriptionIsUsable(access)
    ? access.planCode
    : "free";
}

export type SubscriptionFeatureAccessReason =
  | "available"
  | "unauthenticated"
  | "upgrade_required"
  | "not_released";

export type CurrentSubscriptionFeatureAccess = {
  allowed: boolean;
  reason: SubscriptionFeatureAccessReason;
  effectivePlanCode: SubscriptionPlanCode;
  requiredPlanCode: PublicSubscriptionPlanCode | null;
  isAdminExempt: boolean;
};

/**
 * Rich server-side entitlement result for route guards and future locked UI.
 */
export async function getCurrentSubscriptionFeatureAccess(
  feature: SubscriptionFeature,
): Promise<CurrentSubscriptionFeatureAccess> {
  const requiredPlanCode =
    getRequiredSubscriptionPlan(feature);

  if (
    requiredPlanCode === null ||
    !isSubscriptionFeatureReleased(feature)
  ) {
    return {
      allowed: false,
      reason: "not_released",
      effectivePlanCode: "free",
      requiredPlanCode,
      isAdminExempt: false,
    };
  }

  const access =
    await getCurrentSubscriptionAccess();

  if (!access.authenticated) {
    return {
      allowed: false,
      reason: "unauthenticated",
      effectivePlanCode: "free",
      requiredPlanCode,
      isAdminExempt: false,
    };
  }

  const effectivePlanCode =
    getEffectiveSubscriptionPlanCode(access);

  if (access.isAdminExempt) {
    return {
      allowed: true,
      reason: "available",
      effectivePlanCode,
      requiredPlanCode,
      isAdminExempt: true,
    };
  }

  const allowed = hasSubscriptionFeature(
    effectivePlanCode,
    feature,
  );

  return {
    allowed,
    reason: allowed
      ? "available"
      : "upgrade_required",
    effectivePlanCode,
    requiredPlanCode,
    isAdminExempt: false,
  };
}

export async function canCurrentUserAccessSubscriptionFeature(
  feature: SubscriptionFeature,
) {
  const access =
    await getCurrentSubscriptionFeatureAccess(feature);

  return access.allowed;
}
