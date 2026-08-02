import { redirect } from "next/navigation";
import { BusinessTransactionLedger } from "@/components/BusinessTransactionLedger";
import { getBusinessContext } from "@/lib/business/server";
import type {
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessTransaction,
} from "@/lib/business/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TRANSACTION_SELECT =
  "id,business_id,created_by,description,counterparty,type,category,cost_nature,cost_category_id,cost_centre_id,source_recurring_cost_id,recurrence_key,amount,currency,amount_base,exchange_rate_to_base,exchange_rate_date,exchange_rate_source,transaction_date,occurred_at,payment_method,reference,notes,created_at,updated_at";

export default async function BusinessTransactionsPage() {
  const { supabase, user, business } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/setup");

  const [
    { data: transactions },
    { data: categories },
    { data: costCentres },
  ] = await Promise.all([
    supabase
      .from("business_transactions")
      .select(TRANSACTION_SELECT)
      .eq("business_id", business.id)
      .order("occurred_at", { ascending: false })
      .limit(2500),
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
  ]);

  return (
    <BusinessTransactionLedger
      business={business}
      initialTransactions={(transactions ?? []) as BusinessTransaction[]}
      initialCategories={(categories ?? []) as BusinessCostCategory[]}
      initialCostCentres={(costCentres ?? []) as BusinessCostCentre[]}
    />
  );
}
