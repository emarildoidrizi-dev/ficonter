export type Business = {
  id: string;
  owner_id: string;
  name: string;
  legal_name: string | null;
  business_type: string;
  country_code: string;
  base_currency: string;
  fiscal_year_start_month: number;
  created_at: string;
  updated_at: string;
};

export type BusinessTransactionType = "income" | "expense";
export type BusinessCostNature = "fixed" | "variable" | null;

export type BusinessCostCategory = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  default_nature: Exclude<BusinessCostNature, null>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessCostCentre = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessCostBudget = {
  id: string;
  business_id: string;
  category_id: string;
  budget_month: string;
  amount_base: number | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessRecurringCostStatus = "active" | "paused" | "ended";

export type BusinessRecurringCost = {
  id: string;
  business_id: string;
  created_by: string;
  name: string;
  supplier: string | null;
  supplier_id: string | null;
  category_id: string | null;
  category_name: string;
  cost_centre_id: string | null;
  cost_nature: Exclude<BusinessCostNature, null>;
  amount: number | string;
  currency: string;
  amount_base: number | string;
  exchange_rate_to_base: number | string;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
  due_day: number;
  record_time: string;
  timezone: string;
  start_date: string;
  end_date: string | null;
  next_run_at: string | null;
  last_recorded_at: string | null;
  last_error: string | null;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  status: BusinessRecurringCostStatus;
  created_at: string;
  updated_at: string;
};

export type BusinessTransaction = {
  id: string;
  business_id: string;
  created_by: string;
  description: string;
  counterparty: string | null;
  supplier_id: string | null;
  type: BusinessTransactionType;
  category: string;
  cost_nature: BusinessCostNature;
  cost_category_id: string | null;
  cost_centre_id: string | null;
  source_recurring_cost_id: string | null;
  source_supplier_invoice_id: string | null;
  source_inventory_movement_id?: string | null;
  recurrence_key: string | null;
  amount: number | string;
  currency: string;
  amount_base: number | string;
  exchange_rate_to_base: number | string;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
  transaction_date: string;
  occurred_at: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};


export type BusinessSupplierStatus = "active" | "inactive";

export type BusinessSupplier = {
  id: string;
  business_id: string;
  created_by: string;
  name: string;
  legal_name: string | null;
  supplier_code: string | null;
  category: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  tax_id: string | null;
  payment_terms_days: number;
  default_currency: string;
  status: BusinessSupplierStatus;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessSupplierInvoiceStatus = "open" | "paid" | "cancelled";

export type BusinessSupplierInvoice = {
  id: string;
  business_id: string;
  supplier_id: string;
  created_by: string;
  invoice_number: string;
  description: string;
  category_id: string | null;
  category_name: string;
  cost_centre_id: string | null;
  cost_nature: Exclude<BusinessCostNature, null>;
  amount: number | string;
  currency: string;
  amount_base: number | string;
  exchange_rate_to_base: number | string;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
  issue_date: string;
  due_date: string;
  status: BusinessSupplierInvoiceStatus;
  paid_at: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};


export type BusinessInventoryItemStatus = "active" | "discontinued";
export type BusinessInventoryMovementType =
  | "opening_stock"
  | "purchase"
  | "sale"
  | "used"
  | "damaged"
  | "lost"
  | "adjustment_in"
  | "adjustment_out"
  | "return_in"
  | "return_out"
  | "reversal";

export type BusinessInventoryCategory = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessInventoryLocation = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessInventoryItemSnapshot = {
  id: string;
  business_id: string;
  created_by: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  category_name: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  location_id: string | null;
  location_name: string | null;
  unit: string;
  low_stock_threshold: number | string;
  default_purchase_cost: number | string;
  default_purchase_currency: string;
  default_purchase_cost_base: number | string;
  default_exchange_rate_to_base: number | string;
  selling_price_base: number | string;
  status: BusinessInventoryItemStatus;
  notes: string | null;
  quantity_on_hand: number | string;
  inventory_value_base: number | string;
  average_cost_base: number | string;
  potential_sales_value_base: number | string;
  potential_gross_profit_base: number | string;
  movement_count: number;
  last_movement_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessInventoryMovement = {
  id: string;
  business_id: string;
  item_id: string;
  item_name: string;
  item_sku: string;
  created_by: string;
  movement_type: BusinessInventoryMovementType;
  quantity_delta: number | string;
  unit_cost: number | string;
  currency: string;
  unit_cost_base: number | string;
  inventory_value_delta_base: number | string;
  exchange_rate_to_base: number | string;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  transaction_id: string | null;
  reversal_of_id: string | null;
  movement_date: string;
  occurred_at: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};
