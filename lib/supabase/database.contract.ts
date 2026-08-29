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

type AnyTable = {
  Row: any;
  Insert: any;
  Update: any;
  Relationships: any[];
};

type AnyFunction = {
  Args: any;
  Returns: any;
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

type BetaInviteCodesTable = {
  Row: {
    id: string;
    code_hash: string;
    label: string | null;
    active: boolean;
    max_uses: number | null;
    use_count: number;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    code_hash: string;
    label?: string | null;
    active?: boolean;
    max_uses?: number | null;
    use_count?: number;
    expires_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    code_hash?: string;
    label?: string | null;
    active?: boolean;
    max_uses?: number | null;
    use_count?: number;
    expires_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};

type BetaSignupTokensTable = {
  Row: { token: string; invite_code_id: string; expires_at: string; consumed_at: string | null; created_at: string };
  Insert: { token: string; invite_code_id: string; expires_at: string; consumed_at?: string | null; created_at?: string };
  Update: { token?: string; invite_code_id?: string; expires_at?: string; consumed_at?: string | null; created_at?: string };
  Relationships: [];
};

type BetaUserEntitlementsTable = {
  Row: { user_id: string; invite_code_id: string; verified_at: string };
  Insert: { user_id: string; invite_code_id: string; verified_at?: string };
  Update: { user_id?: string; invite_code_id?: string; verified_at?: string };
  Relationships: [];
};

type BetaLoginSessionsTable = {
  Row: { token_hash: string; user_id: string; expires_at: string; created_at: string };
  Insert: { token_hash: string; user_id: string; expires_at: string; created_at?: string };
  Update: { token_hash?: string; user_id?: string; expires_at?: string; created_at?: string };
  Relationships: [];
};

/*
 * E2EE staging schema compatibility overlay.
 *
 * The generated database.types.ts in this branch predates the final staging
 * zero-knowledge migrations. These tables/functions are intentionally widened
 * here so the application contract follows the live staging schema immediately
 * without weakening unrelated Supabase types. Regenerating database.types.ts
 * from staging can later replace this bridge without changing runtime logic.
 */
type E2eeTables = {
  ai_insight_snapshots: AnyTable;
  bills: AnyTable;
  business_audit_log: AnyTable;
  business_cost_budgets: AnyTable;
  business_cost_categories: AnyTable;
  business_cost_centres: AnyTable;
  business_documents: AnyTable;
  business_inventory_categories: AnyTable;
  business_inventory_items: AnyTable;
  business_inventory_locations: AnyTable;
  business_inventory_movements: AnyTable;
  business_recurring_costs: AnyTable;
  business_sale_lines: AnyTable;
  business_sales: AnyTable;
  business_settings: AnyTable;
  business_supplier_invoices: AnyTable;
  business_suppliers: AnyTable;
  business_transactions: AnyTable;
  businesses: AnyTable;
  business_vault_member_keys: AnyTable;
  business_vaults: AnyTable;
  credit_card_activities: AnyTable;
  credit_card_monthly_records: AnyTable;
  debt_payments: AnyTable;
  debts: AnyTable;
  document_upload_intents: AnyTable;
  financial_documents: AnyTable;
  financial_independence_settings: AnyTable;
  goal_investments: AnyTable;
  goals: AnyTable;
  monthly_budget_items: AnyTable;
  monthly_budget_plans: AnyTable;
  transaction_templates: AnyTable;
  transactions: AnyTable;
  user_business_keypairs: AnyTable;
  user_financial_vaults: AnyTable;
};

type ContractTables = {
  beta_invite_codes: BetaInviteCodesTable;
  beta_signup_tokens: BetaSignupTokensTable;
  beta_user_entitlements: BetaUserEntitlementsTable;
  beta_login_sessions: BetaLoginSessionsTable;
} & E2eeTables;

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
  activate_ficonter_beta_for_existing_user: {
    Args: { p_user_id: string; p_code_hash: string };
    Returns: boolean;
  };
  owner_revoke_ficonter_beta_access: {
    Args: { p_user_id: string; p_actor_user_id: string; p_audit_details?: Json };
    Returns: string;
  };

  close_business_sale_e2ee_atomic: AnyFunction;
  create_business_document_e2ee: AnyFunction;
  create_business_inventory_item_e2ee: AnyFunction;
  create_business_inventory_item_e2ee_atomic: AnyFunction;
  ensure_business_vault_record: AnyFunction;
  finalize_business_recurring_cost_run_e2ee: AnyFunction;
  post_monthly_transaction_template_e2ee_atomic: AnyFunction;
  record_automatic_debt_payment_e2ee_atomic: AnyFunction;
  record_business_inventory_movement_e2ee: AnyFunction;
  record_business_inventory_movement_e2ee_atomic: AnyFunction;
  record_business_sale_e2ee_atomic: AnyFunction;
  record_business_supplier_invoice_payment_e2ee: AnyFunction;
  record_credit_card_activity_e2ee_atomic: AnyFunction;
  record_credit_card_payment_e2ee_atomic: AnyFunction;
  record_debt_payment_e2ee_atomic: AnyFunction;
  record_goal_investment_e2ee_atomic: AnyFunction;
  reserve_document_upload_e2ee: AnyFunction;
  restore_business_sale_e2ee_atomic: AnyFunction;
  reverse_business_inventory_movement_e2ee: AnyFunction;
  reverse_business_supplier_invoice_payment_e2ee: AnyFunction;
  reverse_credit_card_activity_e2ee_atomic: AnyFunction;
  reverse_credit_card_payment_e2ee_atomic: AnyFunction;
  reverse_debt_payment_e2ee_atomic: AnyFunction;
  reverse_goal_investment_e2ee_atomic: AnyFunction;
  save_credit_card_monthly_record_e2ee_atomic: AnyFunction;
  save_financial_independence_settings_e2ee_atomic: AnyFunction;
  save_monthly_budget_plan_e2ee_atomic: AnyFunction;
  update_business_administration_settings_e2ee: AnyFunction;
  update_business_document_e2ee: AnyFunction;
  update_business_sale_e2ee_atomic: AnyFunction;
  update_business_workspace_e2ee: AnyFunction;

  admin_issue_vault_recovery_access: AnyFunction;
  admin_revoke_vault_recovery_access: AnyFunction;
  customer_bind_vault_recovery_key: AnyFunction;
  customer_claim_vault_recovery_access: AnyFunction;
  customer_complete_vault_assisted_recovery: AnyFunction;
  customer_complete_vault_recovery_bootstrap: AnyFunction;
  customer_create_financial_vault_with_recovery: AnyFunction;
  customer_submit_vault_recovery_consent: AnyFunction;
  ficonter_get_active_recovery_private_key: AnyFunction;
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
