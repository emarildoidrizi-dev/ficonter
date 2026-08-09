export type SubscriptionPlanCode =
  | "beta"
  | "free"
  | "personal_pro"
  | "business_pro";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

export type BillingInterval = "monthly" | "annual" | null;

export type SubscriptionFeature =
  | "transactions"
  | "bills"
  | "monthly_planner"
  | "savings"
  | "debt"
  | "credit_cards"
  | "goals"
  | "net_worth_basic"
  | "net_worth_advanced"
  | "cash_flow_intelligence"
  | "emergency_fund_intelligence"
  | "financial_gps"
  | "financial_independence"
  | "advanced_insights"
  | "advanced_exports"
  | "business_workspace"
  | "business_transactions"
  | "business_sales"
  | "business_inventory"
  | "business_cost_control"
  | "business_suppliers"
  | "business_reports"
  | "business_administration";

export type SubscriptionPlanDefinition = {
  code: SubscriptionPlanCode;
  name: string;
  shortName: string;
  description: string;
  monthlyPriceEur: number | null;
  annualPriceEur: number | null;
  public: boolean;
  features: readonly SubscriptionFeature[];
};

const FREE_FEATURES: readonly SubscriptionFeature[] = [
  "transactions",
  "bills",
  "monthly_planner",
  "savings",
  "debt",
  "credit_cards",
  "goals",
  "net_worth_basic",
];

const PERSONAL_PRO_FEATURES: readonly SubscriptionFeature[] = [
  ...FREE_FEATURES,
  "net_worth_advanced",
  "cash_flow_intelligence",
  "emergency_fund_intelligence",
  "financial_gps",
  "financial_independence",
  "advanced_insights",
  "advanced_exports",
];

const BUSINESS_PRO_FEATURES: readonly SubscriptionFeature[] = [
  ...PERSONAL_PRO_FEATURES,
  "business_workspace",
  "business_transactions",
  "business_sales",
  "business_inventory",
  "business_cost_control",
  "business_suppliers",
  "business_reports",
  "business_administration",
];

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlanCode,
  SubscriptionPlanDefinition
> = {
  beta: {
    code: "beta",
    name: "Ficonter Beta Access",
    shortName: "Beta Access",
    description:
      "Full Ficonter access during private testing. No payment is required.",
    monthlyPriceEur: null,
    annualPriceEur: null,
    public: false,
    features: BUSINESS_PRO_FEATURES,
  },
  free: {
    code: "free",
    name: "Ficonter Free",
    shortName: "Free",
    description:
      "Essential personal money management for everyday financial control.",
    monthlyPriceEur: 0,
    annualPriceEur: 0,
    public: true,
    features: FREE_FEATURES,
  },
  personal_pro: {
    code: "personal_pro",
    name: "Ficonter Personal Pro",
    shortName: "Personal Pro",
    description:
      "The complete personal finance experience with advanced financial intelligence.",
    monthlyPriceEur: 4.99,
    annualPriceEur: 49,
    public: true,
    features: PERSONAL_PRO_FEATURES,
  },
  business_pro: {
    code: "business_pro",
    name: "Ficonter Business Pro",
    shortName: "Business Pro",
    description:
      "Everything in Personal Pro plus the complete Ficonter Business workspace.",
    monthlyPriceEur: 9.99,
    annualPriceEur: 99,
    public: true,
    features: BUSINESS_PRO_FEATURES,
  },
};

export const PUBLIC_SUBSCRIPTION_PLANS = [
  SUBSCRIPTION_PLANS.free,
  SUBSCRIPTION_PLANS.personal_pro,
  SUBSCRIPTION_PLANS.business_pro,
] as const;

export function normalizeSubscriptionPlan(
  value: unknown,
): SubscriptionPlanCode {
  if (
    value === "beta" ||
    value === "free" ||
    value === "personal_pro" ||
    value === "business_pro"
  ) {
    return value;
  }
  return "beta";
}

export function normalizeSubscriptionStatus(
  value: unknown,
): SubscriptionStatus {
  if (
    value === "trialing" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "unpaid"
  ) {
    return value;
  }
  return "active";
}

export function hasSubscriptionFeature(
  planCode: SubscriptionPlanCode,
  feature: SubscriptionFeature,
) {
  return SUBSCRIPTION_PLANS[planCode].features.includes(feature);
}

export function isSubscriptionAccessActive(status: SubscriptionStatus) {
  return status === "active" || status === "trialing";
}
