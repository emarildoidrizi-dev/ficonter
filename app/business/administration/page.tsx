import { redirect } from "next/navigation";
import { BusinessAdministration } from "@/components/BusinessAdministration";
import { getBusinessContext } from "@/lib/business/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessAdministrationPage() {
  const { supabase, user, business, membership } = await getBusinessContext();

  if (!user) redirect("/login");
  if (!business) redirect("/business/manage");

  const canManage =
    membership?.role === "owner" || membership?.role === "admin";

  if (!canManage) {
    return (
      <section style={{ padding: "32px" }}>
        <h1>Business Administration</h1>
        <p>Only the business owner or an administrator can open this area.</p>
      </section>
    );
  }

  const [
    settingsResult,
    auditResult,
    transactionsResult,
    suppliersResult,
    invoicesResult,
    inventoryResult,
    movementsResult,
    salesResult,
    categoriesResult,
    centresResult,
  ] = await Promise.all([
    supabase
      .from("business_settings")
      .select(
        "business_id,default_timezone,date_format,number_format,default_payment_method,default_payment_terms_days,default_sales_tax_rate,invoice_prefix,next_invoice_number,default_low_stock_threshold,created_at,updated_at",
      )
      .eq("business_id", business.id)
      .single(),
    supabase
      .from("business_audit_log")
      .select(
        "id,business_id,actor_id,actor_label,action,entity_type,entity_id,summary,metadata,occurred_at",
      )
      .eq("business_id", business.id)
      .order("occurred_at", { ascending: false })
      .limit(100),
    supabase
      .from("business_transactions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id),
    supabase
      .from("business_suppliers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id),
    supabase
      .from("business_supplier_invoices")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id),
    supabase
      .from("business_inventory_items")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id),
    supabase
      .from("business_inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id),
    supabase
      .from("business_sales")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id),
    supabase
      .from("business_cost_categories")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id),
    supabase
      .from("business_cost_centres")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id),
  ]);

  if (settingsResult.error) {
    throw new Error(settingsResult.error.message);
  }

  return (
    <BusinessAdministration
      userId={user.id}
      role={membership?.role ?? "viewer"}
      initialBusiness={business}
      initialSettings={settingsResult.data}
      initialAudit={auditResult.data ?? []}
      counts={{
        transactions: transactionsResult.count ?? 0,
        suppliers: suppliersResult.count ?? 0,
        supplierInvoices: invoicesResult.count ?? 0,
        inventoryItems: inventoryResult.count ?? 0,
        inventoryMovements: movementsResult.count ?? 0,
        sales: salesResult.count ?? 0,
        costCategories: categoriesResult.count ?? 0,
        costCentres: centresResult.count ?? 0,
      }}
    />
  );
}
