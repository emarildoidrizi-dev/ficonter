import type {
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessInventoryCategory,
  BusinessInventoryItemSnapshot,
  BusinessInventoryLocation,
  BusinessInventoryMovement,
  BusinessSupplier,
} from "@/lib/business/types";
import {
  buildBusinessInventorySnapshots,
  type BusinessInventoryItemRow,
} from "@/lib/e2ee/businessInventoryClientSource";

export type BusinessInventorySource = {
  items: BusinessInventoryItemSnapshot[];
  rawItems: BusinessInventoryItemRow[];
  movements: BusinessInventoryMovement[];
  categories: BusinessInventoryCategory[];
  locations: BusinessInventoryLocation[];
  suppliers: BusinessSupplier[];
  costCategories: BusinessCostCategory[];
  costCentres: BusinessCostCentre[];
};

export async function loadBusinessInventorySource(
  client: any,
  businessId: string,
): Promise<BusinessInventorySource> {
  const [
    itemResult,
    movementResult,
    categoryResult,
    locationResult,
    supplierResult,
    costCategoryResult,
    costCentreResult,
  ] = await Promise.all([
    client.from("business_inventory_items").select("*").eq("business_id", businessId),
    client.from("business_inventory_movements").select("*").eq("business_id", businessId),
    client.from("business_inventory_categories").select("*").eq("business_id", businessId),
    client.from("business_inventory_locations").select("*").eq("business_id", businessId),
    client.from("business_suppliers").select("*").eq("business_id", businessId),
    client.from("business_cost_categories").select("*").eq("business_id", businessId),
    client.from("business_cost_centres").select("*").eq("business_id", businessId),
  ]);

  const firstError =
    itemResult.error ??
    movementResult.error ??
    categoryResult.error ??
    locationResult.error ??
    supplierResult.error ??
    costCategoryResult.error ??
    costCentreResult.error;
  if (firstError) throw firstError;

  const rawItems = (itemResult.data ?? []) as BusinessInventoryItemRow[];
  const movements = ((movementResult.data ?? []) as BusinessInventoryMovement[])
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const categories = ((categoryResult.data ?? []) as BusinessInventoryCategory[])
    .sort((a, b) => a.name.localeCompare(b.name));
  const locations = ((locationResult.data ?? []) as BusinessInventoryLocation[])
    .sort((a, b) => a.name.localeCompare(b.name));
  const suppliers = ((supplierResult.data ?? []) as BusinessSupplier[])
    .sort((a, b) => a.name.localeCompare(b.name));
  const costCategories = ((costCategoryResult.data ?? []) as BusinessCostCategory[])
    .sort((a, b) => a.name.localeCompare(b.name));
  const costCentres = ((costCentreResult.data ?? []) as BusinessCostCentre[])
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    rawItems,
    movements,
    categories,
    locations,
    suppliers,
    costCategories,
    costCentres,
    items: buildBusinessInventorySnapshots({
      items: rawItems,
      movements,
      categories,
      suppliers,
      locations,
    }).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
