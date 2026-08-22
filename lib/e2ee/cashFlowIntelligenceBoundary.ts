import type { CurrencySourceData } from "@/lib/finance/baseCurrencyReconciliation";
import type { CashFlowIntelligenceInputs } from "@/lib/wealth/cashFlowIntelligence";

type BoundaryState = {
  userId: string;
  getInputs: () => CashFlowIntelligenceInputs;
  getSource: () => CurrencySourceData;
};

type Filters = Record<string, unknown>;

function localQuery(
  rows: () => Record<string, unknown>[],
  mode: "many" | "maybeSingle" = "many",
) {
  const filters: Filters = {};
  const minimums: Filters = {};
  let singleMode = mode === "maybeSingle";

  const execute = async () => {
    let data = rows();
    for (const [field, value] of Object.entries(filters)) {
      data = data.filter((row) => row[field] === value);
    }
    for (const [field, value] of Object.entries(minimums)) {
      data = data.filter((row) => String(row[field] ?? "") >= String(value ?? ""));
    }
    return {
      data: singleMode ? data[0] ?? null : data,
      error: null,
    };
  };

  const query: any = {
    eq(field: string, value: unknown) {
      filters[field] = value;
      return query;
    },
    gte(field: string, value: unknown) {
      minimums[field] = value;
      return query;
    },
    maybeSingle() {
      singleMode = true;
      return execute();
    },
    then(onFulfilled: any, onRejected: any) {
      return execute().then(onFulfilled, onRejected);
    },
    catch(onRejected: any) {
      return execute().catch(onRejected);
    },
    finally(onFinally: any) {
      return execute().finally(onFinally);
    },
  };
  return query;
}

function normalizedColumns(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}

export function installCashFlowIntelligenceE2eeBoundary(
  client: any,
  userId: string,
  getInputs: () => CashFlowIntelligenceInputs,
  getSource: () => CurrencySourceData,
) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterCashFlowBoundaryState as BoundaryState | undefined;
  if (existing) {
    existing.userId = userId;
    existing.getInputs = getInputs;
    existing.getSource = getSource;
    return;
  }

  const state: BoundaryState = { userId, getInputs, getSource };
  rawClient.__ficonterCashFlowBoundaryState = state;
  const originalRpc = rawClient.rpc.bind(rawClient);
  const originalFrom = rawClient.from.bind(rawClient);

  rawClient.rpc = (
    fn: string,
    args?: Record<string, unknown>,
    options?: unknown,
  ) => {
    if (
      fn === "get_cash_flow_intelligence_inputs" ||
      fn === "get_cash_flow_intelligence_inputs_v2"
    ) {
      return Promise.resolve({ data: state.getInputs(), error: null });
    }
    return originalRpc(fn, args, options);
  };

  rawClient.from = (relation: string) => {
    const builder = originalFrom(relation);
    if (!["debt_payments", "bills", "monthly_budget_plans"].includes(relation)) {
      return builder;
    }

    return new Proxy(builder, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property !== "select" || typeof value !== "function") {
          return typeof value === "function" ? value.bind(target) : value;
        }

        return (columns: unknown, ...args: unknown[]) => {
          const normalized = normalizedColumns(columns);
          const source = () => state.getSource();

          if (
            relation === "debt_payments" &&
            normalized === "debt_id,amount_eur,paid_at"
          ) {
            return localQuery(() =>
              source().debtPayments.map((row) => ({
                user_id: state.userId,
                debt_id: row.debt_id,
                amount_eur: row.amount_eur,
                paid_at: row.paid_at,
              })),
            );
          }

          if (
            relation === "bills" &&
            normalized === "id,status,amount_eur,due_date,paid_at,transaction_id"
          ) {
            return localQuery(() =>
              source().bills.map((row) => ({
                user_id: state.userId,
                id: row.id,
                status: row.status,
                amount_eur: row.amount_eur,
                due_date: row.due_date,
                paid_at: row.paid_at,
                transaction_id: row.transaction_id,
              })),
            );
          }

          if (
            relation === "monthly_budget_plans" &&
            normalized === "start_balance"
          ) {
            return localQuery(() =>
              source().plans.map((row) => ({
                user_id: state.userId,
                month: row.month,
                start_balance: row.start_balance,
              })),
              "maybeSingle",
            );
          }

          return value.apply(target, [columns, ...args]);
        };
      },
    });
  };
}
