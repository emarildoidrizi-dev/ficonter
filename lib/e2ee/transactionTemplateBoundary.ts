import {
  decryptTransactionTemplatePayload,
  encryptTransactionTemplatePayload,
  type TransactionTemplatePrivatePayloadV1,
} from "@/lib/e2ee/transactionTemplatePayload";
import { encryptTransactionPayload } from "@/lib/e2ee/transactionPayload";

type State = { vaultKey: CryptoKey; userId: string };
type DeferredCall = { property: PropertyKey; args: unknown[] };
type RecordValue = Record<string, any>;

const PRIVATE_FIELDS = [
  "label",
  "description",
  "amount",
  "currency",
  "amount_eur",
  "exchange_rate_to_eur",
  "exchange_rate_date",
  "exchange_rate_source",
  "type",
  "category",
] as const;

function finite(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function payloadFrom(record: RecordValue): TransactionTemplatePrivatePayloadV1 {
  return {
    label: String(record.label ?? "").trim(),
    description: String(record.description ?? "").trim(),
    amount: finite(record.amount),
    currency: String(record.currency ?? "EUR").toUpperCase(),
    amount_eur: finite(record.amount_eur),
    exchange_rate_to_eur: finite(record.exchange_rate_to_eur, 1),
    exchange_rate_date: String(record.exchange_rate_date ?? new Date().toISOString().slice(0, 10)),
    exchange_rate_source: String(record.exchange_rate_source ?? "transaction template"),
    type: record.type === "income" || record.type === "saving" ? record.type : "expense",
    category: String(record.category ?? "").trim(),
  };
}

function stripPrivate(record: RecordValue) {
  const next: RecordValue = { ...record, encryption_version: 1 };
  for (const field of PRIVATE_FIELDS) next[field] = null;
  return next;
}

async function openRow(state: State, row: any) {
  if (!row || row.encryption_version !== 1 || !row.encrypted_payload) return row;
  const payload = await decryptTransactionTemplatePayload(state.vaultKey, state.userId, row);
  return { ...row, ...payload };
}

async function openResult(state: State, result: any) {
  if (!result || result.error || result.data == null) return result;
  if (Array.isArray(result.data)) {
    return { ...result, data: await Promise.all(result.data.map((row: any) => openRow(state, row))) };
  }
  return { ...result, data: await openRow(state, result.data) };
}

function wrapReadBuilder(builder: any, state: State): any {
  return new Proxy(builder, {
    get(target, property, receiver) {
      if (property === "then") {
        return (onFulfilled: any, onRejected: any) =>
          Promise.resolve(target).then((result) => openResult(state, result)).then(onFulfilled, onRejected);
      }
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => wrapReadBuilder(value.apply(target, args), state);
    },
  });
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
    if (typeof method !== "function") throw new Error(`Unsupported template mutation step: ${String(call.property)}`);
    current = method.apply(current, call.args);
  }
  return current;
}

function monthDate(periodKey: string, dayValue: unknown) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(periodKey)
    ? periodKey.slice(0, 7)
    : new Date().toISOString().slice(0, 7);
  const [year, month] = base.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(Math.round(finite(dayValue, 1)), 1), lastDay);
  return `${base}-${String(day).padStart(2, "0")}`;
}

export function installTransactionTemplateE2eeBoundary(client: any, vaultKey: CryptoKey, userId: string) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterTransactionTemplateBoundary as State | undefined;
  if (existing) {
    existing.vaultKey = vaultKey;
    existing.userId = userId;
    return;
  }

  const state: State = { vaultKey, userId };
  rawClient.__ficonterTransactionTemplateBoundary = state;
  const originalFrom = rawClient.from.bind(rawClient);
  const originalRpc = rawClient.rpc.bind(rawClient);

  rawClient.from = (relation: string) => {
    const builder = originalFrom(relation);
    if (relation !== "transaction_templates") return builder;

    return new Proxy(builder, {
      get(target, property, receiver) {
        const original = Reflect.get(target, property, receiver);

        if (property === "select" && typeof original === "function") {
          return (...args: unknown[]) => wrapReadBuilder(original.apply(target, args), state);
        }

        if ((property === "insert" || property === "upsert") && typeof original === "function") {
          return (value: unknown, ...args: unknown[]) => deferredMutation(async (calls) => {
            const source = Array.isArray(value) ? value : [value];
            const encryptedRows = await Promise.all(source.map(async (item: any) => {
              const id = String(item?.id ?? crypto.randomUUID());
              const payload = payloadFrom(item ?? {});
              const cipher = await encryptTransactionTemplatePayload(state.vaultKey, state.userId, id, payload);
              return stripPrivate({ ...item, id, user_id: state.userId, encrypted_payload: cipher, encryption_version: 1 });
            }));
            let mutation = original.call(target, Array.isArray(value) ? encryptedRows : encryptedRows[0], ...args);
            mutation = replay(mutation, calls);
            const result = await mutation;
            return openResult(state, result);
          });
        }

        return typeof original === "function" ? original.bind(target) : original;
      },
    });
  };

  rawClient.rpc = (fn: string, args?: Record<string, unknown>, options?: unknown) => {
    if (fn !== "post_monthly_transaction_template") return originalRpc(fn, args, options);

    return (async () => {
      const templateId = String(args?.p_template_id ?? "");
      const periodKey = String(args?.p_period_key ?? new Date().toISOString().slice(0, 7) + "-01");
      const { data: rawTemplate, error } = await originalFrom("transaction_templates")
        .select("*")
        .eq("id", templateId)
        .eq("user_id", state.userId)
        .eq("is_active", true)
        .eq("is_recurring", true)
        .single();
      if (error || !rawTemplate) return { data: null, error: error ?? new Error("The recurring entry could not be found.") };

      const template = await openRow(state, rawTemplate);
      if (template.currency !== "EUR") {
        return { data: null, error: new Error("Review the latest exchange rate before posting this recurring entry.") };
      }

      const transactionDate = monthDate(periodKey, template.day_of_month);
      const transactionId = crypto.randomUUID();
      const transactionPayload = await encryptTransactionPayload(state.vaultKey, state.userId, {
        description: template.description,
        amount: finite(template.amount),
        currency: "EUR",
        amount_eur: finite(template.amount),
        exchange_rate_to_eur: 1,
        exchange_rate_date: transactionDate,
        exchange_rate_source: "recurring EUR template",
        type: template.type,
        category: template.category,
        transaction_date: transactionDate,
        occurred_at: `${transactionDate}T12:00:00.000Z`,
      });

      const atomic = await originalRpc("post_monthly_transaction_template_e2ee_atomic", {
        p_template_id: templateId,
        p_period_key: periodKey,
        p_transaction_id: transactionId,
        p_transaction_payload: transactionPayload,
      });
      if (atomic.error) return atomic;
      const returnedId = String(atomic.data?.id ?? transactionId);
      return { data: { id: returnedId, user_id: state.userId, encryption_version: 1 }, error: null };
    })();
  };
}
