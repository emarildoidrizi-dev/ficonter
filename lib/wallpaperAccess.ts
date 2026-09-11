import {
  hasSubscriptionFeature,
  type SubscriptionPlanCode,
} from "@/lib/subscriptionPlans";

/**
 * Background photography is a paid appearance benefit.
 *
 * Free must always resolve to false, regardless of cached wallpaper settings.
 * Personal Pro, Business Pro and Beta inherit the released appearance feature.
 * Platform owners/admins remain exempt from customer subscription gates.
 */
export function hasBackgroundWallpaperAccess(
  planCode: SubscriptionPlanCode,
  isSubscriptionExempt = false,
) {
  if (isSubscriptionExempt) return true;
  return hasSubscriptionFeature(planCode, "appearance_themes");
}
