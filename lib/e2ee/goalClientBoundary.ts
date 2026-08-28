import {
  decryptGoalPayload,
  encryptGoalPayload,
  type GoalPrivatePayloadV1,
} from "@/lib/e2ee/goalPayload";
import {
  decryptGoalInvestmentPayload,
  encryptGoalInvestmentPayload,
} from "@/lib/e2ee/goalInvestmentPayload";
import { encryptTransactionPayload } from "@/lib/e2ee/transactionPayload";

type BoundaryState = { vaultKey: CryptoKey; userId: string };
type DeferredCall = { property: PropertyKey; args: unknown[] };
type RecordValue = Record<string, unknown>;

const GOAL_PRIVATE_FIELDS = ["name", "target_amount", "current_amount", "target_date", "status"] as const;

function finite(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: unknown) {
  return Math.round((finite(value) + Number.EPSILON) * 100) / 100;
}

function goalPayloadFrom(record: RecordValue): GoalPrivatePayloadV1 {
  const status = String(record.status ?? "active");
  return {
    name: String(record.name ?? "Goal"),
    target_amount: finite(record.target_amount),
    current_amount: finite(record.current_amount),
    target_date: typeof record.target_date === "string" && record.target_date ? record.target_date : null,
    status: status === "completed" || status === "paused" ? status : "active",
  };
}

function stripGoalPrivateFields(record: RecordValue): RecordValue {
  const sanitized: RecordValue = { ...record };
  for (const field of GOAL_PRIVATE_FIELDS) sanitized[field] = null;
  return sanitized;
}

function restoreGoal(row: any, payload: GoalPrivatePayloadV1) {
  return { ...row, ...payload };
}

function deferredMutation(execute: (calls: DeferredCall[]) => Promise<unknown>) {
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

function findEqValue(calls: DeferredCall[], column: string) {
  return calls.find((call) => call.property === "eq" && call.args[0] === column)?.args[1];
}

function replay(builder: any, calls: DeferredCall[]) {
  let current = builder;
  for (const call of calls) {
    const method = current?.[call.property as any];
    if (typeof method !== "function") throw new Error(`Unsupported Goal mutation step: ${String(call.property)}`);
    current = method.apply(current, call.args);
  }
  return current;
}

async function loadGoal(originalFrom: any, state: BoundaryState, goalId: string) {
  const { data, error } = await originalFrom("goals")
    .select("*")
    .eq("id", goalId)
    .eq("user_id", state.userId)
    .single();
  if (error || !data) throw error ?? new Error("Goal not found.");
  const payload = data.encryption_version === 1 && data.encrypted_payload
    ? await decryptGoalPayload(state.vaultKey, state.userId, data)
    : goalPayloadFrom(data);
  return { row: data, payload };
}

async function loadInvestment(originalFrom: any, state: BoundaryState, investmentId: string) {
  const { data, error } = await originalFrom("goal_investments")
    .select("*")
    .eq("id", investmentId)
    .eq("user_id", state.userId)
    .single();
  if (error || !data) throw error ?? new Error("Investment not found.");
  const payload = data.encryption_version === 1 && data.encrypted_payload
    ? await decryptGoalInvestmentPayload(state.vaultKey, state.userId, data)
    : {
        amount: finite(data.amount),
        original_amount: data.original_amount == null ? finite(data.amount) : finite(data.original_amount),
        currency: String(data.currency ?? "EUR"),
        exchange_rate_to_eur: finite(data.exchange_rate_to_eur, 1),
        exchange_rate_date: typeof data.exchange_rate_date === "string" ? data.exchange_rate_date : null,
        notes: typeof data.notes === "string" ? data.notes : null,
      };
  return { row: data, payload };
}

export function installGoalE2eeBoundary(client: any, vaultKey: CryptoKey, userId: string) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterGoalBoundaryState as BoundaryState | undefined;
  if (existing) {
    existing.vaultKey = vaultKey;
    existing.userId = userId;
    return;
  }

  const state: BoundaryState = { vaultKey, userId };
  rawClient.__ficonterGoalBoundaryState = state;
  const originalFrom = rawClient.from.bind(rawClient);
  const originalRpc = rawClient.rpc.bind(rawClient);
  const originalChannel = rawClient.channel.bind(rawClient);

  rawClient.channel = (name: string, ...args: unknown[]) => {
    const channel = originalChannel(name, ...args);
    if (name === `goals-module-${state.userId}`) channel.on = () => channel;
    return channel;
  };

  rawClient.from = (relation: string) => {
    const builder = originalFrom(relation);
    if (relation !== "goals") return builder;

    return new Proxy(builder, {
      get(target, property, receiver) {
        const original = Reflect.get(target, property, receiver);
        if ((property !== "insert" && property !== "update") || typeof original !== "function") {
          return typeof original === "function" ? original.bind(target) : original;
        }

        return (value: unknown, ...args: unknown[]) => {
          if (!value || typeof value !== "object" || Array.isArray(value)) return original.call(target, value, ...args);
          const record = value as RecordValue;

          return deferredMutation(async (calls) => {
            const goalId = String(record.id ?? findEqValue(calls, "id") ?? crypto.randomUUID());

            if (property === "insert") {
              const payload = goalPayloadFrom(record);
              const encrypted = await encryptGoalPayload(state.vaultKey, state.userId, goalId, payload);
              const sanitized = stripGoalPrivateFields({
                ...record,
                id: goalId,
                user_id: state.userId,
                encrypted_payload: encrypted,
                encryption_version: 1,
                e2ee_revision: 0,
              });
              const result = await replay(original.call(target, sanitized, ...args), calls);
              if (result?.error) return result;
              if (Array.isArray(result?.data)) return { ...result, data: result.data.map((row: any) => restoreGoal(row, payload)) };
              return result?.data ? { ...result, data: restoreGoal(result.data, payload) } : result;
            }

            const loaded = await loadGoal(originalFrom, state, goalId);
            const revision = finite(loaded.row.e2ee_revision);
            const merged: GoalPrivatePayloadV1 = {
              ...loaded.payload,
              name: "name" in record ? String(record.name ?? "") : loaded.payload.name,
              target_amount: "target_amount" in record ? finite(record.target_amount) : loaded.payload.target_amount,
              current_amount: "current_amount" in record ? finite(record.current_amount) : loaded.payload.current_amount,
              target_date: "target_date" in record ? (typeof record.target_date === "string" && record.target_date ? record.target_date : null) : loaded.payload.target_date,
              status: "status" in record && (record.status === "completed" || record.status === "paused") ? record.status : ("status" in record ? "active" : loaded.payload.status),
            };
            const encrypted = await encryptGoalPayload(state.vaultKey, state.userId, goalId, merged);
            const sanitized = stripGoalPrivateFields({
              ...record,
              encrypted_payload: encrypted,
              encryption_version: 1,
              e2ee_revision: revision + 1,
              updated_at: new Date().toISOString(),
            });
            const result = await replay(
              original.call(target, sanitized, ...args).eq("e2ee_revision", revision),
              calls,
            );
            if (result?.error) return result;
            if (Array.isArray(result?.data)) return { ...result, data: result.data.map((row: any) => restoreGoal(row, merged)) };
            return result?.data ? { ...result, data: restoreGoal(result.data, merged) } : result;
          });
        };
      },
    });
  };

  rawClient.rpc = (fn: string, args?: Record<string, unknown>, options?: unknown) => {
    if (fn !== "record_goal_investment" && fn !== "reverse_goal_investment") {
      return originalRpc(fn, args, options);
    }

    return (async () => {
      if (fn === "record_goal_investment") {
        const goalId = String(args?.p_goal_id ?? "");
        const { row, payload: current } = await loadGoal(originalFrom, state, goalId);
        if (current.status === "paused") return { data: null, error: new Error("Resume this goal before recording an investment.") };

        const amountEur = round(args?.p_amount_eur ?? args?.p_amount);
        const originalAmount = round(args?.p_original_amount ?? args?.p_amount ?? amountEur);
        const currency = String(args?.p_currency ?? "EUR").toUpperCase();
        const rate = finite(args?.p_exchange_rate, 1);
        const investedAt = String(args?.p_invested_at ?? new Date().toISOString());
        const exchangeRateDate = String(args?.p_exchange_rate_date ?? investedAt.slice(0, 10));
        const notes = typeof args?.p_notes === "string" && args.p_notes.trim() ? args.p_notes.trim() : null;
        const remaining = Math.max(0, round(current.target_amount - current.current_amount));
        if (amountEur <= 0 || amountEur > remaining || originalAmount <= 0 || rate <= 0) {
          return { data: null, error: new Error("Investment cannot exceed the remaining goal amount.") };
        }

        const nextAmount = Math.min(current.target_amount, round(current.current_amount + amountEur));
        const updated: GoalPrivatePayloadV1 = {
          ...current,
          current_amount: nextAmount,
          status: nextAmount >= current.target_amount ? "completed" : (current.status === "completed" ? "active" : current.status),
        };
        const investmentId = crypto.randomUUID();
        const transactionId = crypto.randomUUID();
        const [goalCipher, investmentCipher, transactionCipher] = await Promise.all([
          encryptGoalPayload(state.vaultKey, state.userId, goalId, updated),
          encryptGoalInvestmentPayload(state.vaultKey, state.userId, investmentId, {
            amount: amountEur,
            original_amount: originalAmount,
            currency,
            exchange_rate_to_eur: rate,
            exchange_rate_date: exchangeRateDate,
            notes,
          }),
          encryptTransactionPayload(state.vaultKey, state.userId, {
            description: `Goal investment · ${current.name}`,
            amount: originalAmount,
            currency,
            amount_eur: amountEur,
            exchange_rate_to_eur: rate,
            exchange_rate_date: exchangeRateDate,
            exchange_rate_source: "Goal investment",
            type: "saving",
            category: "General savings",
            transaction_date: investedAt.slice(0, 10),
            occurred_at: investedAt,
          }),
        ]);

        const atomic = await originalRpc("record_goal_investment_e2ee_atomic", {
          p_goal_id: goalId,
          p_expected_revision: finite(row.e2ee_revision),
          p_new_goal_payload: goalCipher,
          p_investment_id: investmentId,
          p_investment_payload: investmentCipher,
          p_invested_at: investedAt,
          p_transaction_id: transactionId,
          p_transaction_payload: transactionCipher,
        });
        if (atomic.error) return atomic;

        return {
          data: {
            goal: restoreGoal({ ...row, encrypted_payload: goalCipher, encryption_version: 1, e2ee_revision: finite(row.e2ee_revision) + 1, updated_at: new Date().toISOString() }, updated),
            investment: {
              id: investmentId,
              goal_id: goalId,
              user_id: state.userId,
              amount: amountEur,
              original_amount: originalAmount,
              currency,
              exchange_rate_to_eur: rate,
              exchange_rate_date: exchangeRateDate,
              invested_at: investedAt,
              notes,
              transaction_id: transactionId,
              encrypted_payload: investmentCipher,
              encryption_version: 1,
              e2ee_revision: 0,
              created_at: new Date().toISOString(),
            },
          },
          error: null,
        };
      }

      const investmentId = String(args?.p_investment_id ?? "");
      const investment = await loadInvestment(originalFrom, state, investmentId);
      const goal = await loadGoal(originalFrom, state, String(investment.row.goal_id));
      const restored: GoalPrivatePayloadV1 = {
        ...goal.payload,
        current_amount: Math.max(0, round(goal.payload.current_amount - investment.payload.amount)),
        status: goal.payload.status === "completed" ? "active" : goal.payload.status,
      };
      const cipher = await encryptGoalPayload(state.vaultKey, state.userId, goal.row.id, restored);
      const atomic = await originalRpc("reverse_goal_investment_e2ee_atomic", {
        p_investment_id: investmentId,
        p_expected_revision: finite(goal.row.e2ee_revision),
        p_restored_goal_payload: cipher,
      });
      if (atomic.error) return atomic;
      return {
        data: {
          goal: restoreGoal({ ...goal.row, encrypted_payload: cipher, encryption_version: 1, e2ee_revision: finite(goal.row.e2ee_revision) + 1, updated_at: new Date().toISOString() }, restored),
        },
        error: null,
      };
    })();
  };
}
