import { redirect } from "next/navigation";
import { BusinessOverview } from "@/components/BusinessOverview";
import { getBusinessContext } from "@/lib/business/server";
import type {
  BusinessCostBudget,
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessTransaction,
} from "@/lib/business/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TRANSACTION_SELECT =
  "id,business_id,created_by,description,counterparty,supplier_id,type,category,cost_nature,cost_category_id,cost_centre_id,source_recurring_cost_id,source_supplier_invoice_id,recurrence_key,amount,currency,amount_base,exchange_rate_to_base,exchange_rate_date,exchange_rate_source,transaction_date,occurred_at,payment_method,reference,notes,created_at,updated_at";

export default async function BusinessOverviewPage() {
  const { supabase, user, business } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/setup");

  const [
    { data: transactions },
    { data: budgets },
    { data: categories },
    { data: centres },
  ] = await Promise.all([
    supabase
      .from("business_transactions")
      .select(TRANSACTION_SELECT)
      .eq("business_id", business.id)
      .order("occurred_at", { ascending: false })
      .limit(1000),
    supabase
      .from("business_cost_budgets")
      .select("id,business_id,category_id,budget_month,amount_base,notes,created_at,updated_at")
      .eq("business_id", business.id),
    supabase
      .from("business_cost_categories")
      .select("id,business_id,name,description,default_nature,is_active,created_at,updated_at")
      .eq("business_id", business.id),
    supabase
      .from("business_cost_centres")
      .select("id,business_id,name,description,is_active,created_at,updated_at")
      .eq("business_id", business.id),
  ]);

  return (
    <BusinessOverview
      business={business}
      initialTransactions={(transactions ?? []) as BusinessTransaction[]}
      initialBudgets={(budgets ?? []) as BusinessCostBudget[]}
      initialCategories={(categories ?? []) as BusinessCostCategory[]}
      initialCentres={(centres ?? []) as BusinessCostCentre[]}
    />
  );
}
