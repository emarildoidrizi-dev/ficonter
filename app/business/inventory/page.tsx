import { redirect } from "next/navigation";
import { BusinessInventory } from "@/components/BusinessInventory";
import { getBusinessContext } from "@/lib/business/server";
import type {
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessInventoryCategory,
  BusinessInventoryItemSnapshot,
  BusinessInventoryLocation,
  BusinessInventoryMovement,
  BusinessSupplier,
} from "@/lib/business/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessInventoryPage() {
  const { supabase, user, business } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/setup");

  const [
    { data: items },
    { data: movements },
    { data: categories },
    { data: locations },
    { data: suppliers },
    { data: costCategories },
    { data: costCentres },
  ] = await Promise.all([
    supabase
      .from("business_inventory_item_balances")
      .select("*")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
    supabase
      .from("business_inventory_movements")
      .select("id,business_id,item_id,item_name,item_sku,created_by,movement_type,quantity_delta,unit_cost,currency,unit_cost_base,inventory_value_delta_base,exchange_rate_to_base,exchange_rate_date,exchange_rate_source,supplier_id,supplier_name,transaction_id,reversal_of_id,movement_date,occurred_at,reference,notes,created_at")
      .eq("business_id", business.id)
      .order("occurred_at", { ascending: false })
      .limit(2500),
    supabase
      .from("business_inventory_categories")
      .select("id,business_id,name,description,is_active,created_at,updated_at")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
    supabase
      .from("business_inventory_locations")
      .select("id,business_id,name,description,is_active,created_at,updated_at")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
    supabase
      .from("business_suppliers")
      .select("id,business_id,created_by,name,legal_name,supplier_code,category,contact_name,email,phone,website,tax_id,payment_terms_days,default_currency,status,address_line1,address_line2,city,postal_code,country_code,notes,created_at,updated_at")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
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
    <BusinessInventory
      key={business.id}
      business={business}
      initialItems={(items ?? []) as BusinessInventoryItemSnapshot[]}
      initialMovements={(movements ?? []) as BusinessInventoryMovement[]}
      initialCategories={(categories ?? []) as BusinessInventoryCategory[]}
      initialLocations={(locations ?? []) as BusinessInventoryLocation[]}
      initialSuppliers={(suppliers ?? []) as BusinessSupplier[]}
      initialCostCategories={(costCategories ?? []) as BusinessCostCategory[]}
      initialCostCentres={(costCentres ?? []) as BusinessCostCentre[]}
    />
  );
}
