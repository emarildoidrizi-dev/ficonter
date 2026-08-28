import {
  decryptBusinessPayload,
  encryptBusinessPayload,
  type BusinessCiphertextEnvelopeV1,
} from "@/lib/e2ee/businessVault";

type State = { businessKey: CryptoKey; businessId: string };
type DeferredCall = { property: PropertyKey; args: unknown[] };
type RecordValue = Record<string, any>;

type Config = { recordType: string; privateFields: readonly string[] };
const CONFIG: Record<string, Config> = {
  business_inventory_categories: {
    recordType: "inventory-category",
    privateFields: ["name", "description"],
  },
  business_inventory_locations: {
    recordType: "inventory-location",
    privateFields: ["name", "description"],
  },
  business_inventory_items: {
    recordType: "inventory-item",
    privateFields: [
      "name", "sku", "barcode", "unit", "low_stock_threshold",
      "default_purchase_cost", "default_purchase_currency",
      "default_purchase_cost_base", "default_exchange_rate_to_base",
      "selling_price_base", "notes",
    ],
  },
  business_inventory_movements: {
    recordType: "inventory-movement",
    privateFields: [
      "item_name", "item_sku", "movement_type", "quantity_delta",
      "unit_cost", "currency", "unit_cost_base", "inventory_value_delta_base",
      "exchange_rate_to_base", "exchange_rate_date", "exchange_rate_source",
      "supplier_name", "movement_date", "occurred_at", "reference", "notes",
    ],
  },
};

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
function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function deferredMutation(execute: (calls: DeferredCall[]) => Promise<any>) {
  const calls: DeferredCall[] = [];
  let promise: Promise<any> | null = null;
  const run = () => (promise ??= execute(calls));
  const proxy = new Proxy({}, {
    get(_target, property) {
      if (property === "then") return run().then.bind(run());
      if (property === "catch") return run().catch.bind(run());
      if (property === "finally") return run().finally.bind(run());
      return (...args: unknown[]) => { calls.push({ property, args }); return proxy; };
    },
  });
  return proxy;
}

function replay(builder: any, calls: DeferredCall[]) {
  let current = builder;
  for (const call of calls) {
    const method = current?.[call.property as any];
    if (typeof method !== "function") throw new Error(`Unsupported inventory mutation step: ${String(call.property)}`);
    current = method.apply(current, call.args);
  }
  return current;
}

function recordIdFromCalls(calls: DeferredCall[]) {
  const match = calls.find((call) => call.property === "eq" && call.args[0] === "id" && typeof call.args[1] === "string");
  return match ? String(match.args[1]) : "";
}

function privatePayload(config: Config, record: RecordValue) {
  const payload: Record<string, unknown> = {};
  for (const field of config.privateFields) payload[field] = record[field] ?? null;
  return payload;
}

function stripPrivate(config: Config, record: RecordValue) {
  const next: RecordValue = { ...record, encryption_version: 1 };
  for (const field of config.privateFields) next[field] = null;
  return next;
}

async function encryptRow(state: State, table: string, record: RecordValue) {
  const config = CONFIG[table];
  const id = String(record.id ?? crypto.randomUUID());
  const cipher = await encryptBusinessPayload(
    state.businessKey, state.businessId, config.recordType, id, privatePayload(config, record),
  );
  return stripPrivate(config, {
    ...record,
    id,
    business_id: state.businessId,
    encrypted_payload: cipher,
    encryption_version: 1,
  });
}

async function openRow(state: State, table: string, row: any) {
  if (!row || row.encryption_version !== 1 || !row.encrypted_payload) return row;
  const config = CONFIG[table];
  const payload = await decryptBusinessPayload(
    state.businessKey,
    state.businessId,
    config.recordType,
    String(row.id),
    row.encrypted_payload as BusinessCiphertextEnvelopeV1,
  );
  return { ...row, ...payload };
}

async function openTransaction(state: State, row: any) {
  if (!row || row.encryption_version !== 1 || !row.encrypted_payload) return row;
  return {
    ...row,
    ...(await decryptBusinessPayload(
      state.businessKey,
      state.businessId,
      "transaction",
      String(row.id),
      row.encrypted_payload as BusinessCiphertextEnvelopeV1,
    )),
  };
}

async function openResult(state: State, table: string, result: any) {
  if (!result || result.error || result.data == null) return result;
  if (Array.isArray(result.data)) {
    return { ...result, data: await Promise.all(result.data.map((row: any) => openRow(state, table, row))) };
  }
  return { ...result, data: await openRow(state, table, result.data) };
}

function wrapReadBuilder(builder: any, state: State, table: string): any {
  return new Proxy(builder, {
    get(target, property, receiver) {
      if (property === "then") {
        return (onFulfilled: any, onRejected: any) =>
          Promise.resolve(target).then((result) => openResult(state, table, result)).then(onFulfilled, onRejected);
      }
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => wrapReadBuilder(value.apply(target, args), state, table);
    },
  });
}

async function rawOpenedRows(originalFrom: any, state: State, table: string, filter?: (builder: any) => any) {
  let builder = originalFrom(table).select("*").eq("business_id", state.businessId);
  if (filter) builder = filter(builder);
  const result = await builder;
  if (result.error) throw result.error;
  return Promise.all((result.data ?? []).map((row: any) => openRow(state, table, row)));
}

export function installBusinessInventoryBoundary(client: any, businessKey: CryptoKey, businessId: string) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterBusinessInventoryBoundary as State | undefined;
  if (existing) {
    existing.businessKey = businessKey;
    existing.businessId = businessId;
    return;
  }

  const state: State = { businessKey, businessId };
  rawClient.__ficonterBusinessInventoryBoundary = state;
  const originalFrom = rawClient.from.bind(rawClient);
  const originalRpc = rawClient.rpc.bind(rawClient);
  const originalChannel = rawClient.channel.bind(rawClient);

  rawClient.from = (relation: string) => {
    const builder = originalFrom(relation);
    const config = CONFIG[relation];
    if (!config) return builder;
    return new Proxy(builder, {
      get(target, property, receiver) {
        const original = Reflect.get(target, property, receiver);
        if (property === "select" && typeof original === "function") {
          return (...args: unknown[]) => wrapReadBuilder(original.apply(target, args), state, relation);
        }
        if ((property === "insert" || property === "upsert") && typeof original === "function") {
          return (value: unknown, ...args: unknown[]) => deferredMutation(async (calls) => {
            const source = Array.isArray(value) ? value : [value];
            const rows = await Promise.all(source.map((item: any) => encryptRow(state, relation, item ?? {})));
            let mutation = original.call(target, Array.isArray(value) ? rows : rows[0], ...args);
            mutation = replay(mutation, calls);
            return openResult(state, relation, await mutation);
          });
        }
        if (property === "update" && typeof original === "function") {
          return (value: unknown, ...args: unknown[]) => deferredMutation(async (calls) => {
            const id = String((value as RecordValue)?.id ?? recordIdFromCalls(calls));
            if (!id) throw new Error("Encrypted inventory updates require a record id.");
            const current = await originalFrom(relation).select("*").eq("id", id).eq("business_id", state.businessId).maybeSingle();
            if (current.error) throw current.error;
            if (!current.data) throw new Error("Inventory record could not be found.");
            const opened = await openRow(state, relation, current.data);
            const encrypted = await encryptRow(state, relation, { ...opened, ...(value as RecordValue), id });
            let mutation = original.call(target, encrypted, ...args);
            mutation = replay(mutation, calls);
            return openResult(state, relation, await mutation);
          });
        }
        return typeof original === "function" ? original.bind(target) : original;
      },
    });
  };

  rawClient.rpc = (fn: string, args?: Record<string, unknown>, options?: unknown) => {
    if (!["create_business_inventory_item", "record_business_inventory_movement", "reverse_business_inventory_movement"].includes(fn)) {
      return originalRpc(fn, args, options);
    }

    return (async () => {
      try {
        if (fn === "create_business_inventory_item") {
          const itemId = crypto.randomUUID();
          const itemPayload = await encryptBusinessPayload(state.businessKey, state.businessId, "inventory-item", itemId, {
            name: String(args?.p_name ?? ""),
            sku: String(args?.p_sku ?? ""),
            barcode: args?.p_barcode ?? null,
            unit: String(args?.p_unit ?? "unit"),
            low_stock_threshold: finite(args?.p_low_stock_threshold),
            default_purchase_cost: finite(args?.p_default_purchase_cost),
            default_purchase_currency: String(args?.p_default_purchase_currency ?? "EUR"),
            default_purchase_cost_base: finite(args?.p_default_purchase_cost_base),
            default_exchange_rate_to_base: finite(args?.p_default_exchange_rate_to_base, 1),
            selling_price_base: finite(args?.p_selling_price_base),
            notes: args?.p_notes ?? null,
          });

          const openingQuantity = round4(args?.p_opening_quantity);
          let openingMovementId: string | null = null;
          let openingMovementPayload: any = null;
          if (openingQuantity > 0) {
            openingMovementId = crypto.randomUUID();
            const supplierId = typeof args?.p_supplier_id === "string" ? args.p_supplier_id : null;
            let supplierName: string | null = null;
            if (supplierId) {
              const supplier = await originalFrom("business_suppliers").select("*").eq("id", supplierId).eq("business_id", state.businessId).maybeSingle();
              if (supplier.error) throw supplier.error;
              supplierName = supplier.data?.name ?? null;
            }
            const date = todayLocal();
            openingMovementPayload = await encryptBusinessPayload(state.businessKey, state.businessId, "inventory-movement", openingMovementId, {
              item_name: String(args?.p_name ?? ""),
              item_sku: String(args?.p_sku ?? ""),
              movement_type: "opening_stock",
              quantity_delta: openingQuantity,
              unit_cost: round4(args?.p_default_purchase_cost),
              currency: String(args?.p_default_purchase_currency ?? "EUR"),
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
            });
          }

          return originalRpc("create_business_inventory_item_e2ee", {
            p_business_id: state.businessId,
            p_item_id: itemId,
            p_item_payload: itemPayload,
            p_category_id: args?.p_category_id ?? null,
            p_supplier_id: args?.p_supplier_id ?? null,
            p_location_id: args?.p_location_id ?? null,
            p_opening_movement_id: openingMovementId,
            p_opening_movement_payload: openingMovementPayload,
          });
        }

        if (fn === "record_business_inventory_movement") {
          const itemId = String(args?.p_item_id ?? "");
          const rawItemResult = await originalFrom("business_inventory_items").select("*").eq("id", itemId).eq("business_id", state.businessId).maybeSingle();
          if (rawItemResult.error || !rawItemResult.data) return { data: null, error: rawItemResult.error ?? new Error("Inventory item was not found.") };
          const item = await openRow(state, "business_inventory_items", rawItemResult.data);
          const movements = await rawOpenedRows(originalFrom, state, "business_inventory_movements", (builder) => builder.eq("item_id", itemId));
          const currentQuantity = round4(movements.reduce((sum, row) => sum + finite(row.quantity_delta), 0));
          const currentValue = round4(movements.reduce((sum, row) => sum + finite(row.inventory_value_delta_base), 0));
          const averageCost = currentQuantity > 0 ? Math.max(0, currentValue) / currentQuantity : 0;
          const type = String(args?.p_movement_type ?? "");
          const quantity = round4(args?.p_quantity);
          const incoming = ["purchase", "adjustment_in", "return_in"].includes(type);
          if (quantity <= 0) return { data: null, error: new Error("Movement quantity must be greater than zero.") };
          if (!incoming && quantity > currentQuantity) return { data: null, error: new Error(`This movement exceeds the available stock of ${currentQuantity}.`) };

          const supplierId = typeof args?.p_supplier_id === "string" ? args.p_supplier_id : null;
          let supplierName: string | null = null;
          if (supplierId) {
            const supplier = await originalFrom("business_suppliers").select("*").eq("id", supplierId).eq("business_id", state.businessId).maybeSingle();
            if (supplier.error) throw supplier.error;
            supplierName = supplier.data?.name ?? null;
          }

          const unitCost = incoming ? round4(args?.p_unit_cost) : round4(averageCost);
          const unitCostBase = incoming ? round4(args?.p_unit_cost_base) : round4(averageCost);
          const quantityDelta = incoming ? quantity : -quantity;
          const valueDelta = incoming
            ? round4(quantity * unitCostBase)
            : quantity === currentQuantity
              ? -currentValue
              : -round4(quantity * averageCost);
          const movementId = crypto.randomUUID();
          const movementDate = String(args?.p_movement_date ?? todayLocal());
          const occurredAt = String(args?.p_occurred_at ?? new Date().toISOString());
          const currency = incoming ? String(args?.p_currency ?? item.default_purchase_currency ?? "EUR") : String(item.default_purchase_currency ?? "EUR");
          const movementPayload = await encryptBusinessPayload(state.businessKey, state.businessId, "inventory-movement", movementId, {
            item_name: item.name,
            item_sku: item.sku,
            movement_type: type,
            quantity_delta: quantityDelta,
            unit_cost: unitCost,
            currency,
            unit_cost_base: unitCostBase,
            inventory_value_delta_base: valueDelta,
            exchange_rate_to_base: incoming ? finite(args?.p_exchange_rate_to_base, 1) : 1,
            exchange_rate_date: args?.p_exchange_rate_date ?? movementDate,
            exchange_rate_source: incoming ? args?.p_exchange_rate_source ?? null : "Weighted average inventory cost",
            supplier_name: supplierName,
            movement_date: movementDate,
            occurred_at: occurredAt,
            reference: args?.p_reference ?? null,
            notes: args?.p_notes ?? null,
          });

          const nextItem = {
            ...item,
            ...(type === "purchase" ? {
              supplier_id: supplierId ?? item.supplier_id,
              default_purchase_cost: unitCost,
              default_purchase_currency: currency,
              default_purchase_cost_base: unitCostBase,
              default_exchange_rate_to_base: finite(args?.p_exchange_rate_to_base, 1),
            } : {}),
          };
          const itemPayload = await encryptBusinessPayload(
            state.businessKey,
            state.businessId,
            "inventory-item",
            itemId,
            privatePayload(CONFIG.business_inventory_items, nextItem),
          );

          let transactionId: string | null = null;
          let transactionPayload: any = null;
          const createExpense = type === "purchase" && args?.p_create_expense === true;
          const categoryId = typeof args?.p_cost_category_id === "string" ? args.p_cost_category_id : null;
          const centreId = typeof args?.p_cost_centre_id === "string" ? args.p_cost_centre_id : null;
          if (createExpense) {
            let categoryName = "Inventory purchases";
            if (categoryId) {
              const category = await originalFrom("business_cost_categories").select("*").eq("id", categoryId).eq("business_id", state.businessId).maybeSingle();
              if (category.error) throw category.error;
              categoryName = category.data?.name ?? categoryName;
            }
            transactionId = crypto.randomUUID();
            transactionPayload = await encryptBusinessPayload(state.businessKey, state.businessId, "transaction", transactionId, {
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
            });
          }

          const result = await originalRpc("record_business_inventory_movement_e2ee_atomic", {
            p_item_id: itemId,
            p_expected_revision: Number(rawItemResult.data.e2ee_revision ?? 0),
            p_item_payload: itemPayload,
            p_movement_id: movementId,
            p_movement_payload: movementPayload,
            p_supplier_id: supplierId,
            p_transaction_id: transactionId,
            p_transaction_payload: transactionPayload,
            p_cost_category_id: categoryId,
            p_cost_centre_id: centreId,
          });
          if (result.error || !result.data) return result;
          return {
            data: {
              ...result.data,
              item: await openRow(state, "business_inventory_items", result.data.item),
              movement: await openRow(state, "business_inventory_movements", result.data.movement),
              transaction: result.data.transaction ? await openTransaction(state, result.data.transaction) : null,
            },
            error: null,
          };
        }

        const movementId = String(args?.p_movement_id ?? "");
        const rawOriginal = await originalFrom("business_inventory_movements").select("*").eq("id", movementId).eq("business_id", state.businessId).maybeSingle();
        if (rawOriginal.error || !rawOriginal.data) return { data: null, error: rawOriginal.error ?? new Error("Inventory movement was not found.") };
        const original = await openRow(state, "business_inventory_movements", rawOriginal.data);
        if (original.movement_type === "reversal") return { data: null, error: new Error("A reversal entry cannot be reversed again.") };
        const movements = await rawOpenedRows(originalFrom, state, "business_inventory_movements", (builder) => builder.eq("item_id", original.item_id));
        if (movements.some((row) => row.reversal_of_id === movementId)) return { data: null, error: new Error("This movement has already been reversed.") };
        const currentQuantity = round4(movements.reduce((sum, row) => sum + finite(row.quantity_delta), 0));
        if (finite(original.quantity_delta) > 0 && currentQuantity < finite(original.quantity_delta)) {
          return { data: null, error: new Error("There is not enough current stock to reverse this incoming movement.") };
        }
        const reversalId = crypto.randomUUID();
        const occurredAt = String(args?.p_occurred_at ?? new Date().toISOString());
        const reversalPayload = await encryptBusinessPayload(state.businessKey, state.businessId, "inventory-movement", reversalId, {
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
        });
        const reversed = await originalRpc("reverse_business_inventory_movement_e2ee", {
          p_movement_id: movementId,
          p_reversal_id: reversalId,
          p_reversal_payload: reversalPayload,
        });
        if (reversed.error || !reversed.data) return reversed;
        return {
          data: {
            ...reversed.data,
            movement: await openRow(state, "business_inventory_movements", reversed.data.movement),
          },
          error: null,
        };
      } catch (error) {
        return { data: null, error: error instanceof Error ? error : new Error("Encrypted inventory operation failed.") };
      }
    })();
  };

  rawClient.channel = (...args: any[]) => {
    const channel = originalChannel(...args);
    const originalOn = channel.on.bind(channel);
    channel.on = (type: string, filter: any, callback: any) => {
      if (type !== "postgres_changes" || !filter?.table || !CONFIG[filter.table]) return originalOn(type, filter, callback);
      const table = String(filter.table);
      return originalOn(type, filter, (payload: any) => {
        void (async () => {
          try {
            const next = payload?.new && payload.eventType !== "DELETE" ? await openRow(state, table, payload.new) : payload?.new;
            callback({ ...payload, new: next });
          } catch { callback(payload); }
        })();
      });
    };
    return channel;
  };
}
