import { redirect } from "next/navigation";
import { BusinessCostControl } from "@/components/BusinessCostControl";
import { getBusinessContext } from "@/lib/business/server";
import type {
  BusinessCostBudget,
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessRecurringCost,
  BusinessTransaction,
} from "@/lib/business/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TRANSACTION_SELECT =
  "id,business_id,created_by,description,counterparty,type,category,cost_nature,cost_category_id,cost_centre_id,source_recurring_cost_id,recurrence_key,amount,currency,amount_base,exchange_rate_to_base,exchange_rate_date,exchange_rate_source,transaction_date,occurred_at,payment_method,reference,notes,created_at,updated_at";

export default async function BusinessCostControlPage() {
  const { supabase, user, business } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/setup");

  const [
    { data: transactions },
    { data: categories },
    { data: centres },
    { data: budgets },
    { data: recurringCosts },
  ] = await Promise.all([
    supabase
      .from("business_transactions")
      .select(TRANSACTION_SELECT)
      .eq("business_id", business.id)
      .order("occurred_at", { ascending: false })
      .limit(5000),
    supabase
      .from("business_cost_categories")
      .select("id,business_id,name,description,default_nature,is_active,created_at,updated_at")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
    supabase
      .from("business_cost_centres")
      .select("id,business_id,name,description,is_active,created_at,updated_at")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
    supabase
      .from("business_cost_budgets")
      .select("id,business_id,category_id,budget_month,amount_base,notes,created_at,updated_at")
      .eq("business_id", business.id)
      .order("budget_month", { ascending: false }),
    supabase
      .from("business_recurring_costs")
      .select("id,business_id,created_by,name,supplier,category_id,category_name,cost_centre_id,cost_nature,amount,currency,amount_base,exchange_rate_to_base,exchange_rate_date,exchange_rate_source,due_day,record_time,timezone,start_date,end_date,next_run_at,last_recorded_at,last_error,payment_method,reference,notes,status,created_at,updated_at")
      .eq("business_id", business.id)
      .order("next_run_at", { ascending: true, nullsFirst: false }),
  ]);

  return (
    <BusinessCostControl
      business={business}
      initialTransactions={(transactions ?? []) as BusinessTransaction[]}
      initialCategories={(categories ?? []) as BusinessCostCategory[]}
      initialCentres={(centres ?? []) as BusinessCostCentre[]}
      initialBudgets={(budgets ?? []) as BusinessCostBudget[]}
      initialRecurringCosts={(recurringCosts ?? []) as BusinessRecurringCost[]}
    />
  );
}
