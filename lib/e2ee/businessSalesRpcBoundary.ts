import { encryptBusinessPayload } from "@/lib/e2ee/businessVault";
import { loadBusinessInventorySource } from "@/lib/e2ee/businessInventorySource";
import type { BusinessSale, BusinessSaleLine } from "@/lib/business/types";

type State = {
  client: any;
  businessKey: CryptoKey;
  businessId: string;
  baseCurrency: string;
};

type RecordValue = Record<string, any>;

type WorkingItem = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  status: string;
  quantity: number;
  value: number;
  revision: number;
  operations: number;
};

type Prepared = {
  saleId: string;
  salePayload: Record<string, unknown>;
  transactionId: string;
  transactionPayload: Record<string, unknown>;
  lines: Array<Record<string, unknown>>;
  movements: Array<Record<string, unknown>>;
  reversals: Array<Record<string, unknown>>;
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
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function asUuid(value: unknown) {
  return typeof value === "string" && value ? value : null;
}
function errorResult(message: string) {
  return { data: null, error: new Error(message) };
}

async function loadSale(state: State, saleId: string): Promise<BusinessSale> {
  const result = await state.client
    .from("business_sales")
    .select("*")
    .eq("id", saleId)
    .eq("business_id", state.businessId)
    .maybeSingle();
  if (result.error || !result.data) throw result.error ?? new Error("Sale was not found.");
  return result.data as BusinessSale;
}

async function loadSaleLines(state: State, saleId: string): Promise<BusinessSaleLine[]> {
  const result = await state.client
    .from("business_sale_lines")
    .select("*")
    .eq("sale_id", saleId)
    .eq("business_id", state.businessId);
  if (result.error) throw result.error;
  return (result.data ?? []) as BusinessSaleLine[];
}

async function loadMovement(state: State, movementId: string) {
  const result = await state.client
    .from("business_inventory_movements")
    .select("*")
    .eq("id", movementId)
    .eq("business_id", state.businessId)
    .maybeSingle();
  if (result.error || !result.data) throw result.error ?? new Error("A linked inventory movement is missing.");
  return result.data as RecordValue;
}

async function workingItems(state: State) {
  const source = await loadBusinessInventorySource(state.client, state.businessId);
  const map = new Map<string, WorkingItem>();
  for (const item of source.items as Array<RecordValue>) {
    map.set(item.id, {
      id: item.id,
      name: String(item.name ?? ""),
      sku: String(item.sku ?? ""),
      unit: String(item.unit ?? "unit"),
      status: String(item.status ?? "active"),
      quantity: round4(item.quantity_on_hand),
      value: round4(item.inventory_value_base),
      revision: Number(item.e2ee_revision ?? 0),
      operations: 0,
    });
  }
  return map;
}

function nextExpected(item: WorkingItem) {
  return item.revision + item.operations;
}

async function makeReversal(state: State, item: WorkingItem, original: RecordValue, label: string) {
  const reversalId = crypto.randomUUID();
  const occurredAt = new Date().toISOString();
  const payload = await encryptBusinessPayload(
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
      exchange_rate_source: label,
      supplier_name: original.supplier_name ?? null,
      movement_date: occurredAt.slice(0, 10),
      occurred_at: occurredAt,
      reference: original.reference ?? label,
      notes: label,
    },
  );
  const operation = {
    id: reversalId,
    item_id: item.id,
    original_movement_id: String(original.id),
    expected_revision: nextExpected(item),
    encrypted_payload: payload,
  };
  item.quantity = round4(item.quantity - finite(original.quantity_delta));
  item.value = round4(item.value - finite(original.inventory_value_delta_base));
  item.operations += 1;
  return operation;
}

async function prepareSale(
  state: State,
  input: {
    saleId?: string;
    saleNumber: string;
    customerName: string | null;
    customerEmail: string | null;
    currency: string;
    rate: number;
    rateDate: string | null;
    rateSource: string | null;
    saleDate: string;
    occurredAt: string;
    paymentMethod: string | null;
    discount: number;
    tax: number;
    reference: string | null;
    notes: string | null;
    lines: Array<{ id?: string; inventory_item_id: string | null; item_name: string; quantity: number; unit_price: number }>;
    reverseExisting?: BusinessSaleLine[];
  },
): Promise<Prepared> {
  const items = await workingItems(state);
  const reversals: Array<Record<string, unknown>> = [];

  for (const line of input.reverseExisting ?? []) {
    if (!line.inventory_item_id || !line.inventory_movement_id) continue;
    const item = items.get(line.inventory_item_id);
    if (!item) throw new Error("One inventory item from the current Sale no longer exists.");
    const original = await loadMovement(state, line.inventory_movement_id);
    reversals.push(await makeReversal(state, item, original, "Sale edit reversal"));
  }

  const saleId = input.saleId ?? crypto.randomUUID();
  const movements: Array<Record<string, unknown>> = [];
  const lines: Array<Record<string, unknown>> = [];
  let subtotal = 0;
  let subtotalBase = 0;
  let totalCogs = 0;
  let units = 0;

  for (const draft of input.lines) {
    const quantity = Math.abs(finite(draft.quantity));
    const unitPrice = Math.max(0, finite(draft.unit_price));
    if (quantity <= 0) throw new Error("Every sale quantity must be greater than zero.");
    if (!draft.item_name.trim()) throw new Error("Every sale line requires an item or service name.");

    const lineSubtotal = round2(quantity * unitPrice);
    const lineSubtotalBase = round2(lineSubtotal * input.rate);
    let itemName = draft.item_name.trim();
    let itemSku: string | null = null;
    let averageCost = 0;
    let cogs = 0;
    let inventoryMovementId: string | null = null;

    if (draft.inventory_item_id) {
      const item = items.get(draft.inventory_item_id);
      if (!item) throw new Error("One selected inventory item was not found.");
      if (item.status !== "active") throw new Error("A discontinued inventory item cannot be sold.");
      if (item.quantity <= 0 || quantity > item.quantity) {
        throw new Error(`${item.name} has only ${item.quantity} ${item.unit} available.`);
      }
      averageCost = item.quantity > 0 ? Math.max(0, item.value) / item.quantity : 0;
      cogs = quantity === item.quantity
        ? round2(Math.max(0, item.value))
        : round2(quantity * averageCost);
      itemName = item.name;
      itemSku = item.sku;
      inventoryMovementId = crypto.randomUUID();
      const movementPayload = await encryptBusinessPayload(
        state.businessKey,
        state.businessId,
        "inventory-movement",
        inventoryMovementId,
        {
          item_name: item.name,
          item_sku: item.sku,
          movement_type: "sale",
          quantity_delta: -quantity,
          unit_cost: round4(averageCost),
          currency: state.baseCurrency,
          unit_cost_base: round4(averageCost),
          inventory_value_delta_base: -cogs,
          exchange_rate_to_base: 1,
          exchange_rate_date: input.saleDate,
          exchange_rate_source: "Sale COGS",
          supplier_name: null,
          movement_date: input.saleDate,
          occurred_at: input.occurredAt,
          reference: input.reference ?? input.saleNumber,
          notes: "Sold through Business Sales",
        },
      );
      movements.push({
        id: inventoryMovementId,
        item_id: item.id,
        expected_revision: nextExpected(item),
        encrypted_payload: movementPayload,
      });
      item.quantity = round4(item.quantity - quantity);
      item.value = round4(item.value - cogs);
      item.operations += 1;
    }

    const lineId = draft.id ?? crypto.randomUUID();
    const linePayload = await encryptBusinessPayload(
      state.businessKey,
      state.businessId,
      "sale-line",
      lineId,
      {
        item_name: itemName,
        item_sku: itemSku,
        quantity,
        unit_price: unitPrice,
        line_subtotal: lineSubtotal,
        line_subtotal_base: lineSubtotalBase,
        unit_cost_base: round4(averageCost),
        cogs_base: cogs,
        gross_profit_base: round2(lineSubtotalBase - cogs),
      },
    );
    lines.push({
      id: lineId,
      inventory_item_id: draft.inventory_item_id,
      inventory_movement_id: inventoryMovementId,
      encrypted_payload: linePayload,
    });
    subtotal += lineSubtotal;
    subtotalBase += lineSubtotalBase;
    totalCogs += cogs;
    units += quantity;
  }

  subtotal = round2(subtotal);
  subtotalBase = round2(subtotalBase);
  const discount = Math.max(0, round2(input.discount));
  const tax = Math.max(0, round2(input.tax));
  if (discount > subtotal) throw new Error("Discount cannot exceed the sale subtotal.");
  const discountBase = round2(discount * input.rate);
  const taxBase = round2(tax * input.rate);
  const netSalesBase = round2(subtotalBase - discountBase);
  const total = round2(subtotal - discount + tax);
  const totalBase = round2(netSalesBase + taxBase);
  const cogsBase = round2(totalCogs);
  const grossProfitBase = round2(netSalesBase - cogsBase);

  const salePayload = await encryptBusinessPayload(
    state.businessKey,
    state.businessId,
    "sale",
    saleId,
    {
      sale_number: input.saleNumber,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      currency: input.currency,
      exchange_rate_to_base: input.rate,
      exchange_rate_date: input.rateDate,
      exchange_rate_source: input.rateSource,
      subtotal,
      discount,
      tax,
      total,
      subtotal_base: subtotalBase,
      discount_base: discountBase,
      tax_base: taxBase,
      total_base: totalBase,
      net_sales_base: netSalesBase,
      cogs_base: cogsBase,
      gross_profit_base: grossProfitBase,
      line_count: lines.length,
      units_sold: round4(units),
      sale_date: input.saleDate,
      occurred_at: input.occurredAt,
      payment_method: input.paymentMethod,
      reference: input.reference,
      notes: input.notes,
    },
  );

  const transactionId = crypto.randomUUID();
  const transactionPayload = await encryptBusinessPayload(
    state.businessKey,
    state.businessId,
    "transaction",
    transactionId,
    {
      description: `Sale · ${input.saleNumber}`,
      counterparty: input.customerName,
      type: "income",
      category: "Sales revenue",
      cost_nature: null,
      amount: total,
      currency: input.currency,
      amount_base: totalBase,
      exchange_rate_to_base: input.rate,
      exchange_rate_date: input.rateDate,
      exchange_rate_source: input.rateSource ?? "Business sale",
      transaction_date: input.saleDate,
      occurred_at: input.occurredAt,
      payment_method: input.paymentMethod,
      reference: input.reference ?? input.saleNumber,
      notes: input.notes ?? "Revenue recorded from Business Sales",
    },
  );

  return {
    saleId,
    salePayload,
    transactionId,
    transactionPayload,
    lines,
    movements,
    reversals,
  };
}

async function prepareCloseReversals(state: State, saleId: string, label: string) {
  const items = await workingItems(state);
  const lines = await loadSaleLines(state, saleId);
  const reversals: Array<Record<string, unknown>> = [];
  for (const line of lines) {
    if (!line.inventory_item_id || !line.inventory_movement_id) continue;
    const item = items.get(line.inventory_item_id);
    if (!item) throw new Error("One inventory item from this Sale no longer exists.");
    const original = await loadMovement(state, line.inventory_movement_id);
    reversals.push(await makeReversal(state, item, original, label));
  }
  return reversals;
}

async function refreshedSale(state: State, saleId: string) {
  return loadSale(state, saleId);
}

export function installBusinessSalesRpcBoundary(
  client: any,
  businessKey: CryptoKey,
  businessId: string,
  baseCurrency: string,
) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterBusinessSalesRpcBoundary as State | undefined;
  if (existing) {
    existing.client = client;
    existing.businessKey = businessKey;
    existing.businessId = businessId;
    existing.baseCurrency = baseCurrency;
    return;
  }

  const state: State = { client, businessKey, businessId, baseCurrency };
  rawClient.__ficonterBusinessSalesRpcBoundary = state;
  const originalRpc = rawClient.rpc.bind(rawClient);
  const intercepted = new Set([
    "record_business_sale",
    "update_business_sale",
    "refund_business_sale",
    "delete_business_sale",
    "restore_business_sale",
  ]);

  rawClient.rpc = (fn: string, args?: Record<string, unknown>, options?: unknown) => {
    if (!intercepted.has(fn)) return originalRpc(fn, args, options);

    return (async () => {
      try {
        if (fn === "record_business_sale" || fn === "update_business_sale") {
          const saleId = fn === "update_business_sale" ? String(args?.p_sale_id ?? "") : undefined;
          const existingSale = saleId ? await loadSale(state, saleId) : null;
          const oldLines = saleId ? await loadSaleLines(state, saleId) : [];
          const drafts = Array.isArray(args?.p_lines)
            ? args?.p_lines as any[]
            : [];
          if (!drafts.length) return errorResult("Add at least one sale line.");
          const prepared = await prepareSale(state, {
            saleId,
            saleNumber: String(args?.p_sale_number ?? "").trim(),
            customerName: typeof args?.p_customer_name === "string" && args.p_customer_name.trim() ? args.p_customer_name.trim() : null,
            customerEmail: typeof args?.p_customer_email === "string" && args.p_customer_email.trim() ? args.p_customer_email.trim() : null,
            currency: String(args?.p_currency ?? state.baseCurrency).toUpperCase(),
            rate: Math.max(finite(args?.p_exchange_rate_to_base, 1), 0.00000001),
            rateDate: typeof args?.p_exchange_rate_date === "string" ? args.p_exchange_rate_date : null,
            rateSource: typeof args?.p_exchange_rate_source === "string" ? args.p_exchange_rate_source : null,
            saleDate: String(args?.p_sale_date ?? todayKey()),
            occurredAt: String(args?.p_occurred_at ?? new Date().toISOString()),
            paymentMethod: typeof args?.p_payment_method === "string" ? args.p_payment_method : null,
            discount: finite(args?.p_discount),
            tax: finite(args?.p_tax),
            reference: typeof args?.p_reference === "string" && args.p_reference.trim() ? args.p_reference.trim() : null,
            notes: typeof args?.p_notes === "string" && args.p_notes.trim() ? args.p_notes.trim() : null,
            lines: drafts.map((line) => ({
              inventory_item_id: asUuid(line.inventory_item_id),
              item_name: String(line.item_name ?? ""),
              quantity: finite(line.quantity),
              unit_price: finite(line.unit_price),
            })),
            reverseExisting: oldLines,
          });

          const result = fn === "record_business_sale"
            ? await originalRpc("record_business_sale_e2ee_atomic", {
                p_business_id: state.businessId,
                p_sale_id: prepared.saleId,
                p_sale_payload: prepared.salePayload,
                p_transaction_id: prepared.transactionId,
                p_transaction_payload: prepared.transactionPayload,
                p_lines: prepared.lines,
                p_movements: prepared.movements,
              })
            : await originalRpc("update_business_sale_e2ee_atomic", {
                p_sale_id: prepared.saleId,
                p_expected_sale_revision: Number((existingSale as any)?.e2ee_revision ?? 0),
                p_sale_payload: prepared.salePayload,
                p_transaction_id: prepared.transactionId,
                p_transaction_payload: prepared.transactionPayload,
                p_reversals: prepared.reversals,
                p_lines: prepared.lines,
                p_movements: prepared.movements,
              });
          if (result.error) return result;
          return { data: { sale: await refreshedSale(state, prepared.saleId) }, error: null };
        }

        if (fn === "refund_business_sale" || fn === "delete_business_sale") {
          const saleId = String(args?.p_sale_id ?? "");
          const sale = await loadSale(state, saleId);
          if (sale.status !== "completed") return errorResult("Only a completed sale can be changed.");
          const target = fn === "refund_business_sale" ? "refunded" : "deleted";
          const reversals = await prepareCloseReversals(
            state,
            saleId,
            target === "refunded" ? "Sale refund" : "Deleted sale reversal",
          );
          const result = await originalRpc("close_business_sale_e2ee_atomic", {
            p_sale_id: saleId,
            p_expected_sale_revision: Number((sale as any).e2ee_revision ?? 0),
            p_target_status: target,
            p_reversals: reversals,
          });
          if (result.error) return result;
          return {
            data: {
              sale: await refreshedSale(state, saleId),
              deleted_transaction_id: result.data?.deleted_transaction_id ?? null,
            },
            error: null,
          };
        }

        const saleId = String(args?.p_sale_id ?? "");
        const sale = await loadSale(state, saleId);
        if (sale.status !== "refunded" && sale.status !== "deleted") {
          return errorResult("Only a refunded or deleted Sale can be restored.");
        }
        const savedLines = await loadSaleLines(state, saleId);
        if (!savedLines.length) return errorResult("This sale has no lines to restore.");
        const prepared = await prepareSale(state, {
          saleId,
          saleNumber: sale.sale_number,
          customerName: sale.customer_name,
          customerEmail: sale.customer_email,
          currency: sale.currency,
          rate: Math.max(finite(sale.exchange_rate_to_base, 1), 0.00000001),
          rateDate: sale.exchange_rate_date,
          rateSource: "Restored business sale",
          saleDate: sale.sale_date,
          occurredAt: sale.occurred_at,
          paymentMethod: sale.payment_method,
          discount: finite(sale.discount),
          tax: finite(sale.tax),
          reference: sale.reference,
          notes: sale.notes,
          lines: savedLines.map((line) => ({
            id: line.id,
            inventory_item_id: line.inventory_item_id,
            item_name: line.item_name,
            quantity: finite(line.quantity),
            unit_price: finite(line.unit_price),
          })),
        });
        const result = await originalRpc("restore_business_sale_e2ee_atomic", {
          p_sale_id: saleId,
          p_expected_sale_revision: Number((sale as any).e2ee_revision ?? 0),
          p_sale_payload: prepared.salePayload,
          p_transaction_id: prepared.transactionId,
          p_transaction_payload: prepared.transactionPayload,
          p_lines: prepared.lines,
          p_movements: prepared.movements,
        });
        if (result.error) return result;
        return { data: { sale: await refreshedSale(state, saleId) }, error: null };
      } catch (caught) {
        return { data: null, error: caught instanceof Error ? caught : new Error("Encrypted Sales operation failed.") };
      }
    })();
  };
}
