import { loadBusinessInventorySource } from "@/lib/e2ee/businessInventorySource";

type ViewState = {
  client: any;
  businessId: string;
};

type Filters = {
  businessId?: string;
  id?: string;
  limit?: number;
  single?: "single" | "maybeSingle";
};

function createViewQuery(state: ViewState) {
  const filters: Filters = {};
  let promise: Promise<any> | null = null;

  const execute = async () => {
    const source = await loadBusinessInventorySource(state.client, filters.businessId ?? state.businessId);
    let rows = source.items;
    if (filters.id) rows = rows.filter((row) => row.id === filters.id);
    if (filters.limit != null) rows = rows.slice(0, filters.limit);
    if (filters.single === "single") {
      if (rows.length !== 1) {
        return { data: null, error: new Error(rows.length ? "Multiple inventory rows were returned." : "Inventory item was not found.") };
      }
      return { data: rows[0], error: null };
    }
    if (filters.single === "maybeSingle") {
      if (rows.length > 1) return { data: null, error: new Error("Multiple inventory rows were returned.") };
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  };

  const run = () => (promise ??= execute());
  const query: any = {
    select() { return query; },
    eq(column: string, value: unknown) {
      if (column === "business_id" && typeof value === "string") filters.businessId = value;
      if (column === "id" && typeof value === "string") filters.id = value;
      return query;
    },
    order() { return query; },
    limit(value: number) { filters.limit = value; return query; },
    single() { filters.single = "single"; return query; },
    maybeSingle() { filters.single = "maybeSingle"; return query; },
    then(onFulfilled: any, onRejected: any) { return run().then(onFulfilled, onRejected); },
    catch(onRejected: any) { return run().catch(onRejected); },
    finally(onFinally: any) { return run().finally(onFinally); },
  };
  return query;
}

export function installBusinessInventoryViewBoundary(client: any, businessId: string) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterBusinessInventoryViewBoundary as ViewState | undefined;
  if (existing) {
    existing.client = client;
    existing.businessId = businessId;
    return;
  }

  const state: ViewState = { client, businessId };
  rawClient.__ficonterBusinessInventoryViewBoundary = state;
  const originalFrom = rawClient.from.bind(rawClient);
  rawClient.from = (relation: string) => {
    if (relation === "business_inventory_item_balances") return createViewQuery(state);
    return originalFrom(relation);
  };
}
