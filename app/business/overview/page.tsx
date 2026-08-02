import { redirect } from "next/navigation";
import { BusinessOverview } from "@/components/BusinessOverview";
import { getBusinessContext } from "@/lib/business/server";
import type {
  BusinessCostBudget,
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessInventoryItemSnapshot,
  BusinessSale,
  BusinessTransaction,
} from "@/lib/business/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TRANSACTION_SELECT =
  "id,business_id,created_by,description,counterparty,supplier_id,type,category,cost_nature,cost_category_id,cost_centre_id,source_recurring_cost_id,source_supplier_invoice_id,source_inventory_movement_id,source_sale_id,recurrence_key,amount,currency,amount_base,exchange_rate_to_base,exchange_rate_date,exchange_rate_source,transaction_date,occurred_at,payment_method,reference,notes,created_at,updated_at";

export default async function BusinessOverviewPage() {
  const { supabase, user, business } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/setup");

  const [
    { data: transactions },
    { data: budgets },
    { data: categories },
    { data: centres },
    { data: inventory },
    { data: sales },
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
    supabase
      .from("business_inventory_item_balances")
      .select("*")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
    supabase
      .from("business_sales")
      .select("id,business_id,created_by,sale_number,customer_name,customer_email,status,currency,exchange_rate_to_base,exchange_rate_date,exchange_rate_source,subtotal,discount,tax,total,subtotal_base,discount_base,tax_base,total_base,net_sales_base,cogs_base,gross_profit_base,line_count,units_sold,sale_date,occurred_at,payment_method,reference,notes,transaction_id,completed_at,refunded_at,created_at,updated_at")
      .eq("business_id", business.id)
      .order("occurred_at", { ascending: false })
      .limit(1000),
  ]);

  return (
    <BusinessOverview
      business={business}
      initialTransactions={(transactions ?? []) as BusinessTransaction[]}
      initialBudgets={(budgets ?? []) as BusinessCostBudget[]}
      initialCategories={(categories ?? []) as BusinessCostCategory[]}
      initialCentres={(centres ?? []) as BusinessCostCentre[]}
      initialInventory={(inventory ?? []) as BusinessInventoryItemSnapshot[]}
      initialSales={(sales ?? []) as BusinessSale[]}
    />
  );
}
