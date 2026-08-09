import {
  SUBSCRIPTION_FEATURE_CATALOG,
  SUBSCRIPTION_PLANS,
  getRequiredSubscriptionPlan,
  hasSubscriptionFeature,
  type PublicSubscriptionPlanCode,
  type SubscriptionFeature,
  type SubscriptionPlanCode,
} from "@/lib/subscriptionPlans";

const PERSONAL_ROUTE_FEATURES: Readonly<Record<string, SubscriptionFeature>> = {
  "/dashboard": "overview_dashboard",
  "/dashboard/transactions": "transactions",
  "/dashboard/bills": "bills",
  "/dashboard/budget": "monthly_planner",
  "/dashboard/credit-cards": "credit_cards",
  "/dashboard/debt": "debt",
  "/dashboard/cash-flow": "cash_flow_intelligence",
  "/dashboard/savings": "savings_intelligence",
  "/dashboard/goals": "goals",
  "/dashboard/emergency-fund": "emergency_fund_intelligence",
  "/dashboard/net-worth": "net_worth_growth",
  "/dashboard/gps": "financial_gps",
  "/dashboard/financial-independence": "financial_independence",
  "/dashboard/insights": "smart_insights",
  "/dashboard/documents": "financial_documents",
};

export function subscriptionFeatureForPersonalRoute(
  href: string,
): SubscriptionFeature | null {
  return PERSONAL_ROUTE_FEATURES[href] ?? null;
}

export function isSubscriptionFeatureKey(
  value: unknown,
): value is SubscriptionFeature {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(
      SUBSCRIPTION_FEATURE_CATALOG,
      value,
    )
  );
}

export function isSubscriptionFeatureLocked(
  planCode: SubscriptionPlanCode,
  feature: SubscriptionFeature,
) {
  return !hasSubscriptionFeature(planCode, feature);
}

export function getSubscriptionUpgradeHref(
  feature: SubscriptionFeature,
) {
  return `/dashboard/settings?section=subscription&required=${encodeURIComponent(
    feature,
  )}`;
}

export function getRequiredPlanDetails(
  feature: SubscriptionFeature,
): {
  code: PublicSubscriptionPlanCode | null;
  name: string;
  monthlyPriceEur: number | null;
} {
  const code = getRequiredSubscriptionPlan(feature);

  if (!code) {
    return {
      code: null,
      name: "Unavailable",
      monthlyPriceEur: null,
    };
  }

  const plan = SUBSCRIPTION_PLANS[code];

  return {
    code,
    name: plan.shortName,
    monthlyPriceEur: plan.monthlyPriceEur,
  };
}
