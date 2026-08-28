import { encryptBusinessPayload } from "@/lib/e2ee/businessVault";

type State = {
  client: any;
  businessKey: CryptoKey;
  businessId: string;
  baseCurrency: string;
};

type RecordValue = Record<string, any>;

function finite(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function round4(value: unknown) {
  return Math.round((finite(value) + Number.EPSILON) * 10_000) / 10_000;
}
function round2(value: unknown) {
  return Math.round((finite(value) + Number.EPSILON) * 100) / 100;
}
function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function errorResult(message: string) {
  return { data: null, error: new Error(message) };
}

function itemPrivate(row: RecordValue) {
  return {
    name: row.name ?? "",
    sku: row.sku ?? "",
    barcode: row.barcode ?? null,
    unit: row.unit ?? "unit",
    low_stock_threshold: finite(row.low_stock_threshold),
    default_purchase_cost: finite(row.default_purchase_cost),
    default_purchase_currency: row.default_purchase_currency ?? "EUR",
    default_purchase_cost_base: finite(row.default_purchase_cost_base),
    default_exchange_rate_to_base: finite(row.default_exchange_rate_to_base, 1),
    selling_price_base: finite(row.selling_price_base),
    notes: row.notes ?? null,
  };
}

async function getSupplierName(client: any, businessId: string, supplierId: string | null) {
  if (!supplierId) return null;
  const result = await client
    .from("business_suppliers")
    .select("*")
    .eq("id", supplierId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data?.name ?? null;
}

async function getCategoryName(client: any, businessId: string, categoryId: string | null) {
  if (!categoryId) return "Inventory purchases";
  const result = await client
    .from("business_cost_categories")
    .select("*")
    .eq("id", categoryId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data?.name ?? "Inventory purchases";
}

export function installBusinessInventoryRpcBoundary(
  client: any,
  businessKey: CryptoKey,
  businessId: string,
  baseCurrency: string,
) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterBusinessInventoryRpcBoundary as State | undefined;
  if (existing) {
    existing.client = client;
    existing.businessKey = businessKey;
    existing.businessId = businessId;
    existing.baseCurrency = baseCurrency;
    return;
  }

  const state: State = { client, businessKey, businessId, baseCurrency };
  rawClient.__ficonterBusinessInventoryRpcBoundary = state;
  const originalRpc = rawClient.rpc.bind(rawClient);

  rawClient.rpc = (fn: string, args?: Record<string, unknown>, options?: unknown) => {
    if (!["create_business_inventory_item", "record_business_inventory_movement", "reverse_business_inventory_movement"].includes(fn)) {
      return originalRpc(fn, args, options);
    }

    return (async () => {
      try {
        if (fn === "create_business_inventory_item") {
          const itemId = crypto.randomUUID();
          const itemPayload = await encryptBusinessPayload(
            state.businessKey,
            state.businessId,
            "inventory-item",
            itemId,
            {
              name: String(args?.p_name ?? ""),
              sku: String(args?.p_sku ?? ""),
              barcode: args?.p_barcode ?? null,
              unit: String(args?.p_unit ?? "unit"),
              low_stock_threshold: finite(args?.p_low_stock_threshold),
              default_purchase_cost: finite(args?.p_default_purchase_cost),
              default_purchase_currency: String(args?.p_default_purchase_currency ?? state.baseCurrency),
              default_purchase_cost_base: finite(args?.p_default_purchase_cost_base),
              default_exchange_rate_to_base: finite(args?.p_default_exchange_rate_to_base, 1),
              selling_price_base: finite(args?.p_selling_price_base),
              notes: args?.p_notes ?? null,
            },
          );

          const openingQuantity = round4(args?.p_opening_quantity);
          let openingMovementId: string | null = null;
          let openingMovementPayload: Record<string, unknown> | null = null;
          if (openingQuantity > 0) {
            openingMovementId = crypto.randomUUID();
            const supplierId = typeof args?.p_supplier_id === "string" ? args.p_supplier_id : null;
            const supplierName = await getSupplierName(state.client, state.businessId, supplierId);
            const date = localDate();
            openingMovementPayload = await encryptBusinessPayload(
              state.businessKey,
              state.businessId,
              "inventory-movement",
              openingMovementId,
              {
                item_name: String(args?.p_name ?? ""),
                item_sku: String(args?.p_sku ?? ""),
                movement_type: "opening_stock",
                quantity_delta: openingQuantity,
                unit_cost: round4(args?.p_default_purchase_cost),
                currency: String(args?.p_default_purchase_currency ?? state.baseCurrency),
                unit_cost_base: round4(args?.p_default_purchase_cost_base),
                inventory_value_delta_base: round4(openingQuantity * finite(args?.p_default_purchase_cost_base)),
                exchange_rate_to_base: finite(args?.p_default_exchange_rate_to_base, 1),
                exchange_rate_date: date,
                exchange_rate_source: "Opening inventory value",
                supplier_name: supplierName,
                movement_date: date,
                occurred_at: new Date().toISOString(),
                reference: null,
                notes: "Opening stock created with inventory item",
              },
            );
          }

          const result = await originalRpc("create_business_inventory_item_e2ee_atomic", {
            p_business_id: state.businessId,
            p_item_id: itemId,
            p_item_payload: itemPayload,
            p_category_id: args?.p_category_id ?? null,
            p_supplier_id: args?.p_supplier_id ?? null,
            p_location_id: args?.p_location_id ?? null,
            p_status: "active",
            p_opening_movement_id: openingMovementId,
            p_opening_movement_payload: openingMovementPayload,
          });
          if (result.error) return result;
          return { data: { item: { id: itemId }, movement: openingMovementId ? { id: openingMovementId } : null }, error: null };
        }

        if (fn === "record_business_inventory_movement") {
          const itemId = String(args?.p_item_id ?? "");
          const itemResult = await state.client
            .from("business_inventory_items")
            .select("*")
            .eq("id", itemId)
            .eq("business_id", state.businessId)
            .maybeSingle();
          if (itemResult.error || !itemResult.data) {
            return { data: null, error: itemResult.error ?? new Error("Inventory item was not found.") };
          }
          const item = itemResult.data as RecordValue;
          if (item.status !== "active") return errorResult("Archived inventory items cannot receive new movements.");

          const movementsResult = await state.client
            .from("business_inventory_movements")
            .select("*")
            .eq("business_id", state.businessId)
            .eq("item_id", itemId);
          if (movementsResult.error) return movementsResult;
          const movements = (movementsResult.data ?? []) as RecordValue[];
          const currentQuantity = round4(movements.reduce((sum, row) => sum + finite(row.quantity_delta), 0));
          const currentValue = round4(movements.reduce((sum, row) => sum + finite(row.inventory_value_delta_base), 0));
          const averageCost = currentQuantity > 0 ? Math.max(0, currentValue) / currentQuantity : 0;

          const type = String(args?.p_movement_type ?? "");
          const quantity = round4(args?.p_quantity);
          const incoming = ["purchase", "adjustment_in", "return_in"].includes(type);
          if (quantity <= 0) return errorResult("Movement quantity must be greater than zero.");
          if (!incoming && quantity > currentQuantity) {
            return errorResult(`This movement exceeds the available stock of ${currentQuantity}.`);
          }

          const supplierId = typeof args?.p_supplier_id === "string" ? args.p_supplier_id : null;
          const supplierName = await getSupplierName(state.client, state.businessId, supplierId);
          const movementDate = String(args?.p_movement_date ?? localDate());
          const occurredAt = String(args?.p_occurred_at ?? new Date().toISOString());
          const unitCost = incoming ? round4(args?.p_unit_cost) : round4(averageCost);
          const unitCostBase = incoming ? round4(args?.p_unit_cost_base) : round4(averageCost);
          if (type === "purchase" && unitCostBase <= 0) return errorResult("A stock purchase requires a unit cost greater than zero.");
          const quantityDelta = incoming ? quantity : -quantity;
          const valueDelta = incoming
            ? round4(quantity * unitCostBase)
            : quantity === currentQuantity
              ? -currentValue
              : -round4(quantity * averageCost);
          const currency = incoming
            ? String(args?.p_currency ?? state.baseCurrency)
            : state.baseCurrency;

          const movementId = crypto.randomUUID();
          const movementPayload = await encryptBusinessPayload(
            state.businessKey,
            state.businessId,
            "inventory-movement",
            movementId,
            {
              item_name: item.name,
              item_sku: item.sku,
              movement_type: type,
              quantity_delta: quantityDelta,
              unit_cost: unitCost,
              currency,
              unit_cost_base: unitCostBase,
              inventory_value_delta_base: valueDelta,
              exchange_rate_to_base: incoming ? finite(args?.p_exchange_rate_to_base, 1) : 1,
              exchange_rate_date: incoming ? args?.p_exchange_rate_date ?? movementDate : movementDate,
              exchange_rate_source: incoming ? args?.p_exchange_rate_source ?? null : "Weighted average inventory cost",
              supplier_name: supplierName,
              movement_date: movementDate,
              occurred_at: occurredAt,
              reference: args?.p_reference ?? null,
              notes: args?.p_notes ?? null,
            },
          );

          const nextItem = type === "purchase"
            ? {
                ...item,
                supplier_id: supplierId ?? item.supplier_id,
                default_purchase_cost: unitCost,
                default_purchase_currency: currency,
                default_purchase_cost_base: unitCostBase,
                default_exchange_rate_to_base: finite(args?.p_exchange_rate_to_base, 1),
              }
            : item;
          const nextItemPayload = await encryptBusinessPayload(
            state.businessKey,
            state.businessId,
            "inventory-item",
            itemId,
            itemPrivate(nextItem),
          );

          let transactionId: string | null = null;
          let transactionPayload: Record<string, unknown> | null = null;
          const createExpense = type === "purchase" && args?.p_create_expense === true;
          const costCategoryId = typeof args?.p_cost_category_id === "string" ? args.p_cost_category_id : null;
          const costCentreId = typeof args?.p_cost_centre_id === "string" ? args.p_cost_centre_id : null;
          if (createExpense) {
            const categoryName = await getCategoryName(state.client, state.businessId, costCategoryId);
            transactionId = crypto.randomUUID();
            transactionPayload = await encryptBusinessPayload(
              state.businessKey,
              state.businessId,
              "transaction",
              transactionId,
              {
                description: `Inventory purchase: ${item.name}`,
                counterparty: supplierName,
                type: "expense",
                category: categoryName,
                cost_nature: "variable",
                amount: round2(quantity * unitCost),
                currency,
                amount_base: round2(valueDelta),
                exchange_rate_to_base: finite(args?.p_exchange_rate_to_base, 1),
                exchange_rate_date: args?.p_exchange_rate_date ?? movementDate,
                exchange_rate_source: "Inventory purchase",
                transaction_date: movementDate,
                occurred_at: occurredAt,
                payment_method: args?.p_payment_method ?? null,
                reference: args?.p_reference ?? item.sku,
                notes: args?.p_notes ?? "Stock purchase recorded from Inventory",
              },
            );
          }

          const result = await originalRpc("record_business_inventory_movement_e2ee_atomic", {
            p_item_id: itemId,
            p_expected_revision: Number(item.e2ee_revision ?? 0),
            p_movement_id: movementId,
            p_movement_payload: movementPayload,
            p_supplier_id: supplierId,
            p_reversal_of_id: null,
            p_transaction_id: transactionId,
            p_transaction_payload: transactionPayload,
            p_cost_category_id: costCategoryId,
            p_cost_centre_id: costCentreId,
            p_new_item_payload: nextItemPayload,
            p_new_supplier_id: type === "purchase" ? supplierId : null,
          });
          if (result.error) return result;
          return {
            data: {
              movement: { id: movementId },
              transaction: transactionId ? { id: transactionId } : null,
              item_revision: result.data?.item_revision,
            },
            error: null,
          };
        }

        const movementId = String(args?.p_movement_id ?? "");
        const originalResult = await state.client
          .from("business_inventory_movements")
          .select("*")
          .eq("id", movementId)
          .eq("business_id", state.businessId)
          .maybeSingle();
        if (originalResult.error || !originalResult.data) {
          return { data: null, error: originalResult.error ?? new Error("Inventory movement was not found.") };
        }
        const original = originalResult.data as RecordValue;
        if (original.movement_type === "reversal") return errorResult("A reversal entry cannot be reversed again.");

        const movementsResult = await state.client
          .from("business_inventory_movements")
          .select("*")
          .eq("business_id", state.businessId)
          .eq("item_id", original.item_id);
        if (movementsResult.error) return movementsResult;
        const movements = (movementsResult.data ?? []) as RecordValue[];
        if (movements.some((row) => row.reversal_of_id === movementId)) return errorResult("This movement has already been reversed.");
        const currentQuantity = round4(movements.reduce((sum, row) => sum + finite(row.quantity_delta), 0));
        if (finite(original.quantity_delta) > 0 && currentQuantity < finite(original.quantity_delta)) {
          return errorResult("There is not enough current stock to reverse this incoming movement.");
        }

        const itemResult = await state.client
          .from("business_inventory_items")
          .select("*")
          .eq("id", original.item_id)
          .eq("business_id", state.businessId)
          .maybeSingle();
        if (itemResult.error || !itemResult.data) {
          return { data: null, error: itemResult.error ?? new Error("Inventory item was not found.") };
        }
        const item = itemResult.data as RecordValue;
        const reversalId = crypto.randomUUID();
        const occurredAt = String(args?.p_occurred_at ?? new Date().toISOString());
        const reversalPayload = await encryptBusinessPayload(
          state.businessKey,
          state.businessId,
          "inventory-movement",
          reversalId,
          {
            item_name: original.item_name,
            item_sku: original.item_sku,
            movement_type: "reversal",
            quantity_delta: -finite(original.quantity_delta),
            unit_cost: finite(original.unit_cost),
            currency: original.currency,
            unit_cost_base: finite(original.unit_cost_base),
            inventory_value_delta_base: -finite(original.inventory_value_delta_base),
            exchange_rate_to_base: finite(original.exchange_rate_to_base, 1),
            exchange_rate_date: occurredAt.slice(0, 10),
            exchange_rate_source: "Inventory movement reversal",
            supplier_name: original.supplier_name ?? null,
            movement_date: occurredAt.slice(0, 10),
            occurred_at: occurredAt,
            reference: original.reference ?? "Reversal",
            notes: args?.p_notes ?? `Reversal of ${original.movement_type}`,
          },
        );

        const result = await originalRpc("record_business_inventory_movement_e2ee_atomic", {
          p_item_id: String(original.item_id),
          p_expected_revision: Number(item.e2ee_revision ?? 0),
          p_movement_id: reversalId,
          p_movement_payload: reversalPayload,
          p_supplier_id: original.supplier_id ?? null,
          p_reversal_of_id: movementId,
          p_transaction_id: null,
          p_transaction_payload: null,
          p_cost_category_id: null,
          p_cost_centre_id: null,
          p_new_item_payload: null,
          p_new_supplier_id: null,
        });
        if (result.error) return result;
        return { data: { movement: { id: reversalId }, deleted_transaction_id: original.transaction_id ?? null }, error: null };
      } catch (caught) {
        return { data: null, error: caught instanceof Error ? caught : new Error("Encrypted Inventory operation failed.") };
      }
    })();
  };
}
