import type {
  Database as GeneratedDatabase,
  Json,
} from "@/lib/supabase/database.types";

export type BusinessAuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "archived"
  | "restored";

export type BillRecurrence =
  | "none"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "yearly";

export type BillStatus = "pending" | "paid" | "cancelled";

export type MonthlyBudgetSection =
  | "income"
  | "bills"
  | "expenses"
  | "savings"
  | "debt";

export type DebtStatus = "active" | "paid_off" | "paused";

export type DebtCategory =
  | "Credit card"
  | "Personal loan"
  | "Mortgage"
  | "Student loan"
  | "Car loan"
  | "Buy now, pay later"
  | "Tax debt"
  | "Medical debt"
  | "Business loan"
  | "Family loan"
  | "Overdraft"
  | "Other";

export type CreditCardActivityType =
  | "purchase"
  | "interest"
  | "fee"
  | "refund"
  | "adjustment_increase"
  | "adjustment_decrease"
  | "statement_adjustment";

export type GoalStatus = "active" | "completed" | "paused";

type PublicSchema = GeneratedDatabase["public"];
type PublicTables = PublicSchema["Tables"];
type PublicFunctions = PublicSchema["Functions"];

type RefinedTable<
  Name extends keyof PublicTables,
  RowOverride extends object,
  InsertOverride extends object,
  UpdateOverride extends object,
> = Omit<PublicTables[Name], "Row" | "Insert" | "Update"> & {
  Row: Omit<PublicTables[Name]["Row"], keyof RowOverride> & RowOverride;
  Insert: Omit<PublicTables[Name]["Insert"], keyof InsertOverride> &
    InsertOverride;
  Update: Omit<PublicTables[Name]["Update"], keyof UpdateOverride> &
    UpdateOverride;
};

type SubscriptionTable = {
  Row: {
    id: string;
    user_id: string;
    plan_code: "beta" | "free" | "personal_pro" | "business_pro";
    status: "trialing" | "active" | "past_due" | "canceled" | "unpaid";
    billing_interval: "monthly" | "annual" | null;
    provider: "internal" | "paypal";
    paypal_payer_id: string | null;
    paypal_subscription_id: string | null;
    paypal_plan_id: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    plan_code?: "beta" | "free" | "personal_pro" | "business_pro";
    status?: "trialing" | "active" | "past_due" | "canceled" | "unpaid";
    billing_interval?: "monthly" | "annual" | null;
    provider?: "internal" | "paypal";
    paypal_payer_id?: string | null;
    paypal_subscription_id?: string | null;
    paypal_plan_id?: string | null;
    current_period_start?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    plan_code?: "beta" | "free" | "personal_pro" | "business_pro";
    status?: "trialing" | "active" | "past_due" | "canceled" | "unpaid";
    billing_interval?: "monthly" | "annual" | null;
    provider?: "internal" | "paypal";
    paypal_payer_id?: string | null;
    paypal_subscription_id?: string | null;
    paypal_plan_id?: string | null;
    current_period_start?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};
type ContractTables = {
  business_audit_log: RefinedTable<
    "business_audit_log",
    { action: BusinessAuditAction },
    { action: BusinessAuditAction },
    { action?: BusinessAuditAction }
  >;
  bills: RefinedTable<
    "bills",
    { recurrence: BillRecurrence; status: BillStatus },
    { recurrence?: BillRecurrence; status?: BillStatus },
    { recurrence?: BillRecurrence; status?: BillStatus }
  >;
  monthly_budget_items: RefinedTable<
    "monthly_budget_items",
    { section: MonthlyBudgetSection },
    { section: MonthlyBudgetSection },
    { section?: MonthlyBudgetSection }
  >;
  debts: RefinedTable<
    "debts",
    { category: DebtCategory; status: DebtStatus },
    { category: DebtCategory; status?: DebtStatus },
    { category?: DebtCategory; status?: DebtStatus }
  >;
  credit_card_activities: RefinedTable<
    "credit_card_activities",
    { activity_type: CreditCardActivityType },
    { activity_type: CreditCardActivityType },
    { activity_type?: CreditCardActivityType }
  >;
  goals: RefinedTable<
    "goals",
    { status: GoalStatus },
    { status?: GoalStatus },
    { status?: GoalStatus }
  >;
};

type ContractFunctions = {
  create_business_document: Omit<
    PublicFunctions["create_business_document"],
    "Args"
  > & {
    Args: Omit<
      PublicFunctions["create_business_document"]["Args"],
      "p_description" | "p_expires_on"
    > & {
      p_description: string | null;
      p_expires_on: string | null;
    };
  };
  update_business_document: Omit<
    PublicFunctions["update_business_document"],
    "Args"
  > & {
    Args: Omit<
      PublicFunctions["update_business_document"]["Args"],
      "p_description" | "p_expires_on"
    > & {
      p_description: string | null;
      p_expires_on: string | null;
    };
  };
  create_business_workspace: Omit<
    PublicFunctions["create_business_workspace"],
    "Args"
  > & {
    Args: Omit<
      PublicFunctions["create_business_workspace"]["Args"],
      "p_legal_name"
    > & {
      p_legal_name?: string | null;
    };
  };
  update_business_workspace: Omit<
    PublicFunctions["update_business_workspace"],
    "Args"
  > & {
    Args: Omit<
      PublicFunctions["update_business_workspace"]["Args"],
      | "p_legal_name"
      | "p_tax_id"
      | "p_contact_email"
      | "p_contact_phone"
      | "p_website"
      | "p_address_line1"
      | "p_address_line2"
      | "p_city"
      | "p_postal_code"
      | "p_logo_path"
      | "p_cover_image_path"
    > & {
      p_legal_name: string | null;
      p_tax_id: string | null;
      p_contact_email: string | null;
      p_contact_phone: string | null;
      p_website: string | null;
      p_address_line1: string | null;
      p_address_line2: string | null;
      p_city: string | null;
      p_postal_code: string | null;
      p_logo_path: string | null;
      p_cover_image_path: string | null;
    };
  };
};

export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<PublicSchema, "Tables" | "Functions"> & {
    Tables: Omit<PublicTables, keyof ContractTables> &
      ContractTables & { subscriptions: SubscriptionTable };
    Functions: Omit<PublicFunctions, keyof ContractFunctions> &
      ContractFunctions;
  };
};

export type { Json };
