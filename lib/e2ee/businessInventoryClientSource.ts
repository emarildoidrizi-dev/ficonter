import type {
  BusinessInventoryCategory,
  BusinessInventoryItemSnapshot,
  BusinessInventoryLocation,
  BusinessInventoryMovement,
  BusinessSupplier,
} from "@/lib/business/types";

export type BusinessInventoryItemRow = Omit<
  BusinessInventoryItemSnapshot,
  | "category_name"
  | "supplier_name"
  | "location_name"
  | "quantity_on_hand"
  | "inventory_value_base"
  | "average_cost_base"
  | "potential_sales_value_base"
  | "potential_gross_profit_base"
  | "movement_count"
  | "last_movement_at"
>;

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round4(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function buildBusinessInventorySnapshots({
  items,
  movements,
  categories,
  suppliers,
  locations,
}: {
  items: BusinessInventoryItemRow[];
  movements: BusinessInventoryMovement[];
  categories: BusinessInventoryCategory[];
  suppliers: BusinessSupplier[];
  locations: BusinessInventoryLocation[];
}): BusinessInventoryItemSnapshot[] {
  const categoryById = new Map(categories.map((row) => [row.id, row]));
  const supplierById = new Map(suppliers.map((row) => [row.id, row]));
  const locationById = new Map(locations.map((row) => [row.id, row]));
  const movementTotals = new Map<
    string,
    { quantity: number; inventoryValue: number; count: number; lastAt: string | null }
  >();

  for (const movement of movements) {
    const current = movementTotals.get(movement.item_id) ?? {
      quantity: 0,
      inventoryValue: 0,
      count: 0,
      lastAt: null,
    };
    current.quantity += finite(movement.quantity_delta);
    current.inventoryValue += finite(movement.inventory_value_delta_base);
    current.count += 1;
    if (!current.lastAt || movement.occurred_at > current.lastAt) {
      current.lastAt = movement.occurred_at;
    }
    movementTotals.set(movement.item_id, current);
  }

  return items.map((item) => {
    const total = movementTotals.get(item.id);
    const quantity = round4(total?.quantity ?? 0);
    const rawInventoryValue = round4(total?.inventoryValue ?? 0);
    const inventoryValue = quantity === 0 ? 0 : round4(Math.max(0, rawInventoryValue));
    const averageCost = quantity > 0 ? round4(Math.max(0, rawInventoryValue / quantity)) : 0;
    const sellingPrice = finite(item.selling_price_base);
    const potentialSales = round2(Math.max(0, quantity * sellingPrice));
    const potentialGrossProfit = round2(
      Math.max(0, quantity * sellingPrice - rawInventoryValue),
    );

    return {
      ...item,
      category_name: item.category_id
        ? categoryById.get(item.category_id)?.name ?? null
        : null,
      supplier_name: item.supplier_id
        ? supplierById.get(item.supplier_id)?.name ?? null
        : null,
      location_name: item.location_id
        ? locationById.get(item.location_id)?.name ?? null
        : null,
      quantity_on_hand: quantity,
      inventory_value_base: inventoryValue,
      average_cost_base: averageCost,
      potential_sales_value_base: potentialSales,
      potential_gross_profit_base: potentialGrossProfit,
      movement_count: total?.count ?? 0,
      last_movement_at: total?.lastAt ?? null,
    };
  });
}
