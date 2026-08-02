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

export type BusinessTransaction = {
  id: string;
  business_id: string;
  created_by: string;
  description: string;
  counterparty: string | null;
  type: BusinessTransactionType;
  category: string;
  cost_nature: BusinessCostNature;
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
