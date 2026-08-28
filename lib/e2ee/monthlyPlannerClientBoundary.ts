import { decryptBillPayload } from "@/lib/e2ee/billPayload";
import { decryptGoalPayload } from "@/lib/e2ee/goalPayload";
import {
  decryptMonthlyPlanPayload,
  encryptMonthlyPlanPayload,
  type MonthlyPlanPrivatePayloadV1,
} from "@/lib/e2ee/monthlyPlanPayload";
import {
  decryptMonthlyPlanItemPayload,
  encryptMonthlyPlanItemPayload,
  type MonthlyPlanItemPrivatePayloadV1,
} from "@/lib/e2ee/monthlyPlanItemPayload";

type BoundaryState = { vaultKey: CryptoKey; userId: string };
type DeferredCall = { property: PropertyKey; args: unknown[] };
type RecordValue = Record<string, unknown>;

function finite(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function deferred(execute: (calls: DeferredCall[]) => Promise<unknown>) {
  const calls: DeferredCall[] = [];
  let promise: Promise<unknown> | null = null;
  const run = () => (promise ??= execute(calls));
  const proxy = new Proxy({}, {
    get(_target, property) {
      if (property === "then") return run().then.bind(run());
      if (property === "catch") return run().catch.bind(run());
      if (property === "finally") return run().finally.bind(run());
      return (...args: unknown[]) => {
        calls.push({ property, args });
        return proxy;
      };
    },
  });
  return proxy;
}

function replay(builder: any, calls: DeferredCall[]) {
  let current = builder;
  for (const call of calls) {
    const method = current?.[call.property as any];
    if (typeof method !== "function") throw new Error(`Unsupported Monthly Planner query step: ${String(call.property)}`);
    current = method.apply(current, call.args);
  }
  return current;
}

async function openRow(relation: string, state: BoundaryState, row: any) {
  if (!row || row.encryption_version !== 1 || !row.encrypted_payload) return row;
  if (relation === "bills") return { ...row, ...(await decryptBillPayload(state.vaultKey, state.userId, row)) };
  if (relation === "goals") return { ...row, ...(await decryptGoalPayload(state.vaultKey, state.userId, row)) };
  if (relation === "monthly_budget_plans") return { ...row, ...(await decryptMonthlyPlanPayload(state.vaultKey, state.userId, row)) };
  if (relation === "monthly_budget_items") return { ...row, ...(await decryptMonthlyPlanItemPayload(state.vaultKey, state.userId, row)) };
  return row;
}

async function openResult(relation: string, state: BoundaryState, result: any) {
  if (!result || result.error || result.data == null) return result;
  if (Array.isArray(result.data)) {
    return { ...result, data: await Promise.all(result.data.map((row: any) => openRow(relation, state, row))) };
  }
  return { ...result, data: await openRow(relation, state, result.data) };
}

function readBuilder(relation: string, originalFrom: any, state: BoundaryState) {
  return deferred(async (calls) => {
    const result = await replay(originalFrom(relation).select("*"), calls);
    return openResult(relation, state, result);
  });
}

async function loadPlan(originalFrom: any, state: BoundaryState, month: string) {
  const result = await originalFrom("monthly_budget_plans")
    .select("*")
    .eq("user_id", state.userId)
    .eq("month", month)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;
  const payload: MonthlyPlanPrivatePayloadV1 = result.data.encryption_version === 1 && result.data.encrypted_payload
    ? await decryptMonthlyPlanPayload(state.vaultKey, state.userId, result.data)
    : {
        start_balance: finite(result.data.start_balance),
        spending_budget: finite(result.data.spending_budget),
      };
  return { row: result.data, payload };
}

async function loadItem(originalFrom: any, state: BoundaryState, itemId: string) {
  const result = await originalFrom("monthly_budget_items")
    .select("*")
    .eq("id", itemId)
    .eq("user_id", state.userId)
    .single();
  if (result.error || !result.data) throw result.error ?? new Error("Planner item not found.");
  const payload: MonthlyPlanItemPrivatePayloadV1 = result.data.encryption_version === 1 && result.data.encrypted_payload
    ? await decryptMonthlyPlanItemPayload(state.vaultKey, state.userId, result.data)
    : {
        section: result.data.section,
        label: String(result.data.label ?? "Planner item"),
        planned_amount: finite(result.data.planned_amount),
      };
  return { row: result.data, payload };
}

function eqValue(calls: DeferredCall[], column: string) {
  return calls.find((call) => call.property === "eq" && call.args[0] === column)?.args[1];
}

export function installMonthlyPlannerE2eeBoundary(client: any, vaultKey: CryptoKey, userId: string) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterMonthlyPlannerBoundaryState as BoundaryState | undefined;
  if (existing) {
    existing.vaultKey = vaultKey;
    existing.userId = userId;
    return;
  }

  const state: BoundaryState = { vaultKey, userId };
  rawClient.__ficonterMonthlyPlannerBoundaryState = state;
  const originalFrom = rawClient.from.bind(rawClient);
  const originalRpc = rawClient.rpc.bind(rawClient);
  const originalChannel = rawClient.channel.bind(rawClient);

  rawClient.channel = (name: string, ...args: unknown[]) => {
    const channel = originalChannel(name, ...args);
    if (name === `planner-${state.userId}`) channel.on = () => channel;
    return channel;
  };

  rawClient.from = (relation: string) => {
    const base = originalFrom(relation);
    const plannerReadRelation = ["bills", "goals", "monthly_budget_plans", "monthly_budget_items"].includes(relation);

    return new Proxy(base, {
      get(target, property, receiver) {
        const method = Reflect.get(target, property, receiver);

        if (property === "select" && plannerReadRelation && typeof method === "function") {
          return () => readBuilder(relation, originalFrom, state);
        }

        if (relation === "monthly_budget_plans" && property === "upsert" && typeof method === "function") {
          return (value: unknown) => deferred(async () => {
            if (!value || typeof value !== "object" || Array.isArray(value)) return method.call(target, value);
            const record = value as RecordValue;
            const month = String(record.month ?? "");
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { data: null, error: new Error("Invalid Planner month.") };

            const current = await loadPlan(originalFrom, state, month);
            const payload: MonthlyPlanPrivatePayloadV1 = {
              start_balance: "start_balance" in record ? finite(record.start_balance) : (current?.payload.start_balance ?? 0),
              spending_budget: "spending_budget" in record ? finite(record.spending_budget) : (current?.payload.spending_budget ?? 0),
            };
            const planId = current?.row.id ?? String(record.id ?? crypto.randomUUID());
            const cipher = await encryptMonthlyPlanPayload(state.vaultKey, state.userId, planId, payload);
            const revision = current ? finite(current.row.e2ee_revision) : -1;
            const atomic = await originalRpc("save_monthly_budget_plan_e2ee_atomic", {
              p_plan_id: planId,
              p_month: month,
              p_expected_revision: revision,
              p_encrypted_payload: cipher,
            });
            if (atomic.error) return atomic;

            const now = new Date().toISOString();
            return {
              data: {
                ...(current?.row ?? {}),
                id: planId,
                user_id: state.userId,
                month,
                ...payload,
                encrypted_payload: cipher,
                encryption_version: 1,
                e2ee_revision: current ? revision + 1 : 0,
                created_at: current?.row.created_at ?? now,
                updated_at: now,
              },
              error: null,
            };
          });
        }

        if (relation === "monthly_budget_items" && (property === "insert" || property === "update") && typeof method === "function") {
          return (value: unknown, ...args: unknown[]) => {
            if (!value || typeof value !== "object" || Array.isArray(value)) return method.call(target, value, ...args);
            const record = value as RecordValue;
            return deferred(async (calls) => {
              if (property === "insert") {
                const itemId = String(record.id ?? crypto.randomUUID());
                const payload: MonthlyPlanItemPrivatePayloadV1 = {
                  section: record.section as MonthlyPlanItemPrivatePayloadV1["section"],
                  label: String(record.label ?? "Planner item"),
                  planned_amount: finite(record.planned_amount),
                };
                const cipher = await encryptMonthlyPlanItemPayload(state.vaultKey, state.userId, itemId, payload);
                const sanitized = {
                  ...record,
                  id: itemId,
                  user_id: state.userId,
                  section: null,
                  label: null,
                  planned_amount: null,
                  encrypted_payload: cipher,
                  encryption_version: 1,
                  e2ee_revision: 0,
                };
                const result = await replay(method.call(target, sanitized, ...args), calls);
                return result?.data ? { ...result, data: Array.isArray(result.data) ? result.data.map((row: any) => ({ ...row, ...payload })) : { ...result.data, ...payload } } : result;
              }

              const itemId = String(eqValue(calls, "id") ?? record.id ?? "");
              const current = await loadItem(originalFrom, state, itemId);
              const payload: MonthlyPlanItemPrivatePayloadV1 = {
                section: "section" in record ? record.section as MonthlyPlanItemPrivatePayloadV1["section"] : current.payload.section,
                label: "label" in record ? String(record.label ?? "") : current.payload.label,
                planned_amount: "planned_amount" in record ? finite(record.planned_amount) : current.payload.planned_amount,
              };
              const cipher = await encryptMonthlyPlanItemPayload(state.vaultKey, state.userId, itemId, payload);
              const revision = finite(current.row.e2ee_revision);
              const sanitized = {
                ...record,
                section: null,
                label: null,
                planned_amount: null,
                encrypted_payload: cipher,
                encryption_version: 1,
                e2ee_revision: revision + 1,
                updated_at: new Date().toISOString(),
              };
              const result = await replay(method.call(target, sanitized, ...args).eq("e2ee_revision", revision), calls);
              return result?.data ? { ...result, data: Array.isArray(result.data) ? result.data.map((row: any) => ({ ...row, ...payload })) : { ...result.data, ...payload } } : result;
            });
          };
        }

        return typeof method === "function" ? method.bind(target) : method;
      },
    });
  };
}
