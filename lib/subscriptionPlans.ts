export type SubscriptionPlanCode =
  | "beta"
  | "free"
  | "personal_pro"
  | "business_pro";

export type PublicSubscriptionPlanCode =
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

export type SubscriptionFeatureLifecycle =
  | "released"
  | "preview"
  | "planned";

export type SubscriptionFeatureMinimumPlan =
  | PublicSubscriptionPlanCode
  | "later";

type SubscriptionFeatureDefinition = {
  label: string;
  category: string;
  minimumPlan: SubscriptionFeatureMinimumPlan;
  lifecycle: SubscriptionFeatureLifecycle;
};

/**
 * FICONTER subscription feature catalog.
 *
 * This is the central plan blueprint approved for the subscription system.
 * - "released": existing production feature.
 * - "preview": partially built / currently available feature.
 * - "planned": roadmap feature; plan assignment is reserved but access stays off.
 * - minimumPlan "later": intentionally not assigned to any customer plan yet.
 *
 * Business Pro inherits Personal Pro, and Personal Pro inherits Free.
 */
export const SUBSCRIPTION_FEATURE_CATALOG = {
  // Personal finance
  overview_dashboard: {
    label: "Overview Dashboard",
    category: "Personal finance",
    minimumPlan: "free",
    lifecycle: "released",
  },
  transactions: {
    label: "Transactions",
    category: "Personal finance",
    minimumPlan: "free",
    lifecycle: "released",
  },
  transaction_management: {
    label: "Add / Edit / Delete Transactions",
    category: "Personal finance",
    minimumPlan: "free",
    lifecycle: "released",
  },
  transaction_categories: {
    label: "Transaction categories",
    category: "Personal finance",
    minimumPlan: "free",
    lifecycle: "released",
  },
  multi_currency_transactions: {
    label: "Multi-currency transaction recording",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  bills: {
    label: "Bills",
    category: "Personal finance",
    minimumPlan: "free",
    lifecycle: "released",
  },
  monthly_planner: {
    label: "Monthly Planner",
    category: "Personal finance",
    minimumPlan: "free",
    lifecycle: "released",
  },
  planner_available_now: {
    label: "Available Now",
    category: "Personal finance",
    minimumPlan: "free",
    lifecycle: "released",
  },
  planner_still_to_pay: {
    label: "Still to Pay",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  planner_left_after_everything_paid: {
    label: "Left After Everything Is Paid",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  savings: {
    label: "Savings",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  debt: {
    label: "Debts / Loans",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  debt_payments: {
    label: "Debt payment recording",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  credit_cards: {
    label: "Credit Cards",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  credit_card_limits: {
    label: "Credit limit / available credit",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  credit_card_apr: {
    label: "APR tracking",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  credit_card_minimum_payment: {
    label: "Minimum payment calculation",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  credit_card_statement_due: {
    label: "Statement balance / due date",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  credit_card_monthly_history: {
    label: "Credit-card monthly history",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  goals: {
    label: "Goals",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  goal_investments: {
    label: "Goal investment recording",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  net_worth_basic: {
    label: "Net Worth",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  financial_documents: {
    label: "Financial documents",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  private_pdf_export: {
    label: "Private financial PDF export",
    category: "Personal finance",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  csv_export: {
    label: "CSV export",
    category: "Personal finance",
    minimumPlan: "free",
    lifecycle: "released",
  },
  json_export: {
    label: "JSON full-account export",
    category: "Personal finance",
    minimumPlan: "free",
    lifecycle: "released",
  },

  // Financial intelligence
  financial_health_score: {
    label: "Financial Health Score",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  wealth_score: {
    label: "Wealth Score",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  financial_gps: {
    label: "Financial GPS",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  cash_flow_intelligence: {
    label: "Cash Flow Intelligence",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  emergency_fund_intelligence: {
    label: "Emergency Fund analysis",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  savings_intelligence: {
    label: "Savings Intelligence",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  net_worth_growth: {
    label: "Net Worth Growth",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  financial_independence: {
    label: "Financial Independence",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  smart_insights: {
    label: "Smart Insights",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  advanced_financial_recommendations: {
    label: "Advanced financial recommendations",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  future_cash_flow_forecast: {
    label: "Future cash-flow forecast",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  safe_to_spend: {
    label: "Safe to Spend amount",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  end_of_month_balance_prediction: {
    label: "End-of-month balance prediction",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  financial_risk_alerts: {
    label: "Financial risk alerts",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  debt_payoff_optimizer: {
    label: "Debt payoff optimizer",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  credit_card_interest_simulator: {
    label: "Credit-card interest simulator",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  financial_what_if_simulator: {
    label: "What-if financial simulator",
    category: "Financial intelligence",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },

  // Automation
  realtime_sync: {
    label: "Realtime synchronization",
    category: "Automation",
    minimumPlan: "free",
    lifecycle: "released",
  },
  recurring_bills: {
    label: "Recurring bills",
    category: "Automation",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  recurring_income: {
    label: "Recurring income",
    category: "Automation",
    minimumPlan: "free",
    lifecycle: "planned",
  },
  automatic_bill_reminders: {
    label: "Automatic bill reminders",
    category: "Automation",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  upcoming_payment_alerts: {
    label: "Upcoming-payment alerts",
    category: "Automation",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  goal_progress_notifications: {
    label: "Goal-progress notifications",
    category: "Automation",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  monthly_financial_summary: {
    label: "Monthly financial summary",
    category: "Automation",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  automatic_month_rollover: {
    label: "Automatic month rollover",
    category: "Automation",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  automatic_savings_rules: {
    label: "Automatic savings rules",
    category: "Automation",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  automatic_debt_payment_planning: {
    label: "Automatic debt-payment planning",
    category: "Automation",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  subscription_payment_tracker: {
    label: "Subscription/service payment tracker",
    category: "Automation",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },

  // Business Workspace
  business_workspace: {
    label: "Business Workspace",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  multiple_businesses: {
    label: "Multiple businesses",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_profile_switching: {
    label: "Business profile switching",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_profile_identity: {
    label: "Business logo/profile",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_income: {
    label: "Business income",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_expenses: {
    label: "Business expenses",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_cash_flow: {
    label: "Business cash flow",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_sales: {
    label: "Sales tracking",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_cost_control: {
    label: "Cost tracking",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_inventory: {
    label: "Inventory",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_reports: {
    label: "Business reporting",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_dashboard: {
    label: "Business financial dashboard",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_roles: {
    label: "Business roles",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_role_owner: {
    label: "Owner role",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_role_administrator: {
    label: "Administrator role",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_role_manager: {
    label: "Manager role",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_role_accountant: {
    label: "Accountant role",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_role_viewer: {
    label: "Viewer role",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_financial_health_score: {
    label: "Business financial health score",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "planned",
  },
  business_profit_margin_analysis: {
    label: "Profit-margin analysis",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "planned",
  },
  business_break_even_calculator: {
    label: "Break-even calculator",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "planned",
  },
  business_revenue_forecasting: {
    label: "Revenue forecasting",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "planned",
  },
  business_expense_anomaly_detection: {
    label: "Expense anomaly detection",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "planned",
  },
  business_customer_invoice_tracking: {
    label: "Customer/invoice tracking",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "planned",
  },
  business_suppliers: {
    label: "Supplier tracking",
    category: "Business Workspace",
    minimumPlan: "business_pro",
    lifecycle: "planned",
  },

  // Account & customization
  profile: {
    label: "Profile",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "released",
  },
  profile_photo: {
    label: "Profile photo",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "released",
  },
  change_login_email: {
    label: "Change login email",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "released",
  },
  change_password: {
    label: "Change password",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "released",
  },
  session_controls: {
    label: "Session controls",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "released",
  },
  remember_device: {
    label: "Remember device",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "released",
  },
  financial_preferences: {
    label: "Financial preferences",
    category: "Account & customization",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  appearance_themes: {
    label: "Appearance themes",
    category: "Account & customization",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  wallpaper_scenes: {
    label: "Wallpaper scenes",
    category: "Account & customization",
    minimumPlan: "later",
    lifecycle: "planned",
  },
  time_based_wallpapers: {
    label: "Time-based photographic wallpapers",
    category: "Account & customization",
    minimumPlan: "later",
    lifecycle: "planned",
  },
  animated_backgrounds: {
    label: "Animated backgrounds",
    category: "Account & customization",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  layout_density: {
    label: "Compact / comfortable layout",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "released",
  },
  language_selector: {
    label: "Language selector",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "released",
  },
  language_english: {
    label: "English",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "released",
  },
  language_german: {
    label: "German",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  language_spanish: {
    label: "Spanish",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  language_albanian: {
    label: "Albanian",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  language_arabic_rtl: {
    label: "Arabic / RTL",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  language_portuguese: {
    label: "Portuguese",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  language_italian: {
    label: "Italian",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  language_russian: {
    label: "Russian",
    category: "Account & customization",
    minimumPlan: "free",
    lifecycle: "preview",
  },

  // Mobile / accessibility
  responsive_web: {
    label: "Responsive web app",
    category: "Mobile / accessibility",
    minimumPlan: "free",
    lifecycle: "released",
  },
  installable_pwa: {
    label: "Installable PWA",
    category: "Mobile / accessibility",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  standalone_app_mode: {
    label: "Standalone app mode",
    category: "Mobile / accessibility",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  offline_access: {
    label: "Offline access",
    category: "Mobile / accessibility",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  mobile_interface: {
    label: "Mobile-specific interface",
    category: "Mobile / accessibility",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  tablet_support: {
    label: "Tablet support",
    category: "Mobile / accessibility",
    minimumPlan: "free",
    lifecycle: "released",
  },
  landscape_support: {
    label: "Landscape orientation support",
    category: "Mobile / accessibility",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  offline_transaction_sync: {
    label: "Offline transaction entry + later sync",
    category: "Mobile / accessibility",
    minimumPlan: "free",
    lifecycle: "planned",
  },

  // Subscription & billing
  paypal_subscription_checkout: {
    label: "PayPal subscription checkout",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "released",
  },
  monthly_billing: {
    label: "Monthly billing",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "released",
  },
  annual_billing: {
    label: "Annual billing",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "released",
  },
  subscription_status_sync: {
    label: "Subscription status synchronization",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "released",
  },
  past_due_handling: {
    label: "Past-due handling",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "released",
  },
  subscription_reactivation: {
    label: "Reactivation",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "released",
  },
  cancel_subscription: {
    label: "Cancel inside FICONTER",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "released",
  },
  cancellation_grace_access: {
    label: "Paid-access grace after cancellation",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "released",
  },
  billing_settings: {
    label: "Billing settings",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "released",
  },
  billing_history: {
    label: "Billing history",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  payment_pdf_download: {
    label: "Download payment PDF",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  production_tax_invoices: {
    label: "Production tax invoices",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  upgrade_personal_to_business: {
    label: "Upgrade Personal → Business",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "planned",
  },
  downgrade_business_to_personal: {
    label: "Downgrade Business → Personal",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "planned",
  },
  free_trial: {
    label: "Free trial",
    category: "Subscription & billing",
    minimumPlan: "free",
    lifecycle: "preview",
  },
  promo_discount_codes: {
    label: "Promo / discount codes",
    category: "Subscription & billing",
    minimumPlan: "later",
    lifecycle: "planned",
  },

  // New ideas
  ai_financial_assistant: {
    label: "FICONTER AI Financial Assistant",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  ai_can_i_afford_this: {
    label: "Ask: Can I afford this?",
    category: "New ideas",
    minimumPlan: "free",
    lifecycle: "planned",
  },
  ai_spending_explanation: {
    label: "Ask: Why did I spend more this month?",
    category: "New ideas",
    minimumPlan: "free",
    lifecycle: "planned",
  },
  ai_savings_plan: {
    label: "Ask: How can I save €500?",
    category: "New ideas",
    minimumPlan: "free",
    lifecycle: "planned",
  },
  natural_language_financial_search: {
    label: "Natural-language financial search",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  financial_timeline: {
    label: "Financial Timeline",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  financial_forecast_30_60_90: {
    label: "Upcoming 30/60/90-day financial forecast",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  money_calendar: {
    label: "Money Calendar showing bills/income/payments",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  digital_piggy_bank: {
    label: "Digital Piggy Bank with animated savings visualization",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  shared_household_finances: {
    label: "Shared household / couple finances",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  family_member_access: {
    label: "Family member access",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  receipt_expense_extraction: {
    label: "Receipt upload / expense extraction",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  document_expiry_reminders: {
    label: "Warranty/document expiry reminders",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  income_calendar: {
    label: "Salary / income calendar",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  net_worth_milestones: {
    label: "Net-worth milestones",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  monthly_financial_report_card: {
    label: "Monthly financial report card",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  financial_stress_indicator: {
    label: "Personal financial stress level indicator",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  goal_probability: {
    label: "Goal probability — chance of reaching goal on time",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  spending_anomaly_alerts: {
    label: "Spending anomaly alerts",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  duplicate_charge_detection: {
    label: "Duplicate-charge detection",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },
  large_expense_warning: {
    label: "Large upcoming expense warning",
    category: "New ideas",
    minimumPlan: "personal_pro",
    lifecycle: "planned",
  },

  // Compatibility gates
  net_worth_advanced: {
    label: "Advanced net worth (compatibility gate)",
    category: "Compatibility gates",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  advanced_insights: {
    label: "Advanced insights (compatibility gate)",
    category: "Compatibility gates",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  advanced_exports: {
    label: "Advanced exports (compatibility gate)",
    category: "Compatibility gates",
    minimumPlan: "personal_pro",
    lifecycle: "released",
  },
  business_transactions: {
    label: "Business transactions (compatibility gate)",
    category: "Compatibility gates",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
  business_administration: {
    label: "Business administration (compatibility gate)",
    category: "Compatibility gates",
    minimumPlan: "business_pro",
    lifecycle: "released",
  },
} as const satisfies Record<string, SubscriptionFeatureDefinition>;

export type SubscriptionFeature =
  keyof typeof SUBSCRIPTION_FEATURE_CATALOG;

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

const PUBLIC_PLAN_RANK: Record<
  PublicSubscriptionPlanCode,
  number
> = {
  free: 0,
  personal_pro: 1,
  business_pro: 2,
};

export function getSubscriptionFeatureDefinition(
  feature: SubscriptionFeature,
) {
  return SUBSCRIPTION_FEATURE_CATALOG[feature];
}

export function getRequiredSubscriptionPlan(
  feature: SubscriptionFeature,
): PublicSubscriptionPlanCode | null {
  const minimumPlan =
    SUBSCRIPTION_FEATURE_CATALOG[feature].minimumPlan;

  return minimumPlan === "later" ? null : minimumPlan;
}

export function getSubscriptionFeatureLifecycle(
  feature: SubscriptionFeature,
): SubscriptionFeatureLifecycle {
  return SUBSCRIPTION_FEATURE_CATALOG[feature].lifecycle;
}

/**
 * Planned roadmap features remain inaccessible until their lifecycle is
 * deliberately changed to "released" or "preview".
 */
export function isSubscriptionFeatureReleased(
  feature: SubscriptionFeature,
) {
  const lifecycle =
    SUBSCRIPTION_FEATURE_CATALOG[feature].lifecycle;

  return lifecycle === "released" || lifecycle === "preview";
}

function publicPlanIncludesFeature(
  planCode: PublicSubscriptionPlanCode,
  feature: SubscriptionFeature,
) {
  const requiredPlan =
    getRequiredSubscriptionPlan(feature);

  if (!requiredPlan) {
    return false;
  }

  return (
    PUBLIC_PLAN_RANK[planCode] >=
    PUBLIC_PLAN_RANK[requiredPlan]
  );
}

/**
 * Security/access helper. This only returns true for features that are both
 * assigned to the plan and currently released/preview.
 */
export function hasSubscriptionFeature(
  planCode: SubscriptionPlanCode,
  feature: SubscriptionFeature,
) {
  if (!isSubscriptionFeatureReleased(feature)) {
    return false;
  }

  if (planCode === "beta") {
    return getRequiredSubscriptionPlan(feature) !== null;
  }

  return publicPlanIncludesFeature(planCode, feature);
}

const ALL_SUBSCRIPTION_FEATURES = Object.keys(
  SUBSCRIPTION_FEATURE_CATALOG,
) as SubscriptionFeature[];

function buildReleasedPlanFeatures(
  planCode: SubscriptionPlanCode,
): readonly SubscriptionFeature[] {
  return Object.freeze(
    ALL_SUBSCRIPTION_FEATURES.filter((feature) =>
      hasSubscriptionFeature(planCode, feature),
    ),
  );
}

const FREE_FEATURES =
  buildReleasedPlanFeatures("free");

const PERSONAL_PRO_FEATURES =
  buildReleasedPlanFeatures("personal_pro");

const BUSINESS_PRO_FEATURES =
  buildReleasedPlanFeatures("business_pro");

const BETA_FEATURES =
  buildReleasedPlanFeatures("beta");

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlanCode,
  SubscriptionPlanDefinition
> = {
  beta: {
    code: "beta",
    name: "Ficonter Beta Access",
    shortName: "Beta Access",
    description:
      "Full released Ficonter access during private testing. No payment is required.",
    monthlyPriceEur: null,
    annualPriceEur: null,
    public: false,
    features: BETA_FEATURES,
  },
  free: {
    code: "free",
    name: "Ficonter Free",
    shortName: "Free",
    description:
      "Essential everyday financial control with selected core tools.",
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

/**
 * Fail closed. Unknown plan data must never become Beta/full access.
 */
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

  return "free";
}

/**
 * Fail closed. Unknown billing status must never become active access.
 */
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

  return "unpaid";
}

export function isSubscriptionAccessActive(
  status: SubscriptionStatus,
) {
  return status === "active" || status === "trialing";
}
