import { redirect } from "next/navigation";
import { BusinessSales } from "@/components/BusinessSales";
import { getBusinessContext } from "@/lib/business/server";
import type {
  BusinessInventoryItemSnapshot,
  BusinessSale,
} from "@/lib/business/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessSalesPage() {
  const { supabase, user, business } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/setup");

  const [{ data: sales }, { data: inventory }] = await Promise.all([
    supabase
      .from("business_sales")
      .select("id,business_id,created_by,sale_number,customer_name,customer_email,status,currency,exchange_rate_to_base,exchange_rate_date,exchange_rate_source,subtotal,discount,tax,total,subtotal_base,discount_base,tax_base,total_base,net_sales_base,cogs_base,gross_profit_base,line_count,units_sold,sale_date,occurred_at,payment_method,reference,notes,transaction_id,completed_at,refunded_at,created_at,updated_at")
      .eq("business_id", business.id)
      .order("occurred_at", { ascending: false })
      .limit(2500),
    supabase
      .from("business_inventory_item_balances")
      .select("*")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <BusinessSales
      business={business}
      initialSales={(sales ?? []) as BusinessSale[]}
      initialInventory={(inventory ?? []) as BusinessInventoryItemSnapshot[]}
    />
  );
}
