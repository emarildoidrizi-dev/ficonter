import {
  decryptCreditCardPayload,
  encryptCreditCardPayload,
  type CreditCardPrivatePayloadV1,
} from "@/lib/e2ee/creditCardPayload";
import {
  decryptCreditCardActivityPayload,
  encryptCreditCardActivityPayload,
} from "@/lib/e2ee/creditCardActivityPayload";
import {
  decryptCreditCardMonthlyRecordPayload,
  encryptCreditCardMonthlyRecordPayload,
} from "@/lib/e2ee/creditCardMonthlyRecordPayload";
import {
  decryptDebtPaymentPayload,
  encryptDebtPaymentPayload,
} from "@/lib/e2ee/debtPaymentPayload";
import { encryptTransactionPayload } from "@/lib/e2ee/transactionPayload";
import { creditCardMinimumPayment } from "@/lib/finance/creditCardAccounting";

type BoundaryState = { vaultKey: CryptoKey; userId: string };
type DeferredCall = { property: PropertyKey; args: unknown[] };
type RecordValue = Record<string, unknown>;

const CARD_PRIVATE_FIELDS = [
  "name",
  "lender",
  "description",
  "category",
  "original_balance",
  "current_balance",
  "currency",
  "original_balance_eur",
  "current_balance_eur",
  "exchange_rate_to_eur",
  "annual_interest_rate",
  "minimum_payment",
  "minimum_payment_eur",
  "card_last_four",
  "credit_limit",
  "credit_limit_eur",
  "statement_balance",
  "statement_balance_eur",
  "interest_charged",
  "interest_charged_eur",
] as const;

function finite(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: unknown) {
  return Math.round((finite(value) + Number.EPSILON) * 100) / 100;
}

function cardPayloadFrom(record: RecordValue): CreditCardPrivatePayloadV1 {
  return {
    name: String(record.name ?? "Credit card"),
    lender: typeof record.lender === "string" ? record.lender : null,
    description: typeof record.description === "string" ? record.description : null,
    card_last_four: typeof record.card_last_four === "string" ? record.card_last_four : null,
    currency: String(record.currency ?? "EUR"),
    original_balance: finite(record.original_balance),
    current_balance: finite(record.current_balance),
    original_balance_eur: finite(record.original_balance_eur),
    current_balance_eur: finite(record.current_balance_eur),
    exchange_rate_to_eur: finite(record.exchange_rate_to_eur, 1),
    annual_interest_rate: finite(record.annual_interest_rate),
    credit_limit: finite(record.credit_limit),
    credit_limit_eur: finite(record.credit_limit_eur),
    statement_balance: record.statement_balance == null ? null : finite(record.statement_balance),
    statement_balance_eur: record.statement_balance_eur == null ? null : finite(record.statement_balance_eur),
    minimum_payment: finite(record.minimum_payment),
    minimum_payment_eur: finite(record.minimum_payment_eur),
    statement_date: typeof record.statement_date === "string" ? record.statement_date : null,
    payment_due_date: typeof record.payment_due_date === "string" ? record.payment_due_date : null,
    interest_charged: finite(record.interest_charged),
    interest_charged_eur: finite(record.interest_charged_eur),
  };
}

function stripCardPrivateFields(record: RecordValue): RecordValue {
  const sanitized: RecordValue = { ...record, debt_kind: "credit_card" };
  for (const field of CARD_PRIVATE_FIELDS) sanitized[field] = null;
  return sanitized;
}

function restoredCardRow(row: any, payload: CreditCardPrivatePayloadV1) {
  return { ...row, ...payload, category: "Credit card", debt_kind: "credit_card" };
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

function replay(builder: any, calls: DeferredCall[], options?: { skipCategoryFilter?: boolean }) {
  let current = builder;
  for (const call of calls) {
    if (
      options?.skipCategoryFilter &&
      (call.property === "ilike" || call.property === "eq") &&
      call.args[0] === "category"
    ) continue;
    const method = current?.[call.property as any];
    if (typeof method !== "function") throw new Error(`Unsupported Credit Card mutation step: ${String(call.property)}`);
    current = method.apply(current, call.args);
  }
  return current;
}

async function loadCard(originalFrom: any, state: BoundaryState, cardId: string) {
  const { data, error } = await originalFrom("debts")
    .select("*")
    .eq("id", cardId)
    .eq("user_id", state.userId)
    .single();
  if (error || !data) throw error ?? new Error("Credit card not found.");
  if (data.debt_kind !== "credit_card") throw new Error("Credit card not found.");
  const payload = data.encryption_version === 1 && data.encrypted_payload
    ? await decryptCreditCardPayload(state.vaultKey, state.userId, data)
    : cardPayloadFrom(data);
  return { row: data, payload };
}

async function loadActivity(originalFrom: any, state: BoundaryState, activityId: string) {
  const { data, error } = await originalFrom("credit_card_activities")
    .select("*")
    .eq("id", activityId)
    .eq("user_id", state.userId)
    .single();
  if (error || !data) throw error ?? new Error("Credit-card activity not found.");
  const payload = data.encryption_version === 1 && data.encrypted_payload
    ? await decryptCreditCardActivityPayload(state.vaultKey, state.userId, data)
    : {
        activity_type: data.activity_type,
        description: data.description,
        amount: finite(data.amount),
        currency: data.currency,
        amount_eur: finite(data.amount_eur),
        exchange_rate_to_eur: finite(data.exchange_rate_to_eur, 1),
        balance_effect: finite(data.balance_effect),
        balance_effect_eur: finite(data.balance_effect_eur),
        notes: data.notes ?? null,
      };
  return { row: data, payload };
}

async function loadPayment(originalFrom: any, state: BoundaryState, paymentId: string) {
  const { data, error } = await originalFrom("debt_payments")
    .select("*")
    .eq("id", paymentId)
    .eq("user_id", state.userId)
    .single();
  if (error || !data) throw error ?? new Error("Payment not found.");
  const payload = data.encryption_version === 1 && data.encrypted_payload
    ? await decryptDebtPaymentPayload(state.vaultKey, state.userId, data)
    : {
        amount: finite(data.amount),
        currency: String(data.currency ?? "EUR"),
        amount_eur: finite(data.amount_eur),
        exchange_rate_to_eur: finite(data.exchange_rate_to_eur, 1),
        notes: data.notes ?? null,
      };
  return { row: data, payload };
}

async function decryptMonthlyResult(state: BoundaryState, result: any) {
  if (!result || result.error || !result.data) return result;
  const open = async (row: any) => {
    if (row?.encryption_version === 1 && row?.encrypted_payload) {
      return { ...row, ...(await decryptCreditCardMonthlyRecordPayload(state.vaultKey, state.userId, row)) };
    }
    return row;
  };
  if (Array.isArray(result.data)) return { ...result, data: await Promise.all(result.data.map(open)) };
  return { ...result, data: await open(result.data) };
}

function wrapMonthlyReadBuilder(builder: any, state: BoundaryState): any {
  return new Proxy(builder, {
    get(target, property, receiver) {
      if (property === "then") {
        return (onFulfilled: any, onRejected: any) =>
          Promise.resolve(target).then((result) => decryptMonthlyResult(state, result)).then(onFulfilled, onRejected);
      }
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => wrapMonthlyReadBuilder(value.apply(target, args), state);
    },
  });
}

export function installCreditCardE2eeBoundary(client: any, vaultKey: CryptoKey, userId: string) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterCreditCardBoundaryState as BoundaryState | undefined;
  if (existing) {
    existing.vaultKey = vaultKey;
    existing.userId = userId;
    return;
  }

  const state: BoundaryState = { vaultKey, userId };
  rawClient.__ficonterCreditCardBoundaryState = state;
  const originalFrom = rawClient.from.bind(rawClient);
  const originalRpc = rawClient.rpc.bind(rawClient);
  const originalChannel = rawClient.channel.bind(rawClient);

  rawClient.channel = (name: string, ...args: unknown[]) => {
    const channel = originalChannel(name, ...args);
    if (name === `credit-cards-${state.userId}`) {
      channel.on = () => channel;
    }
    return channel;
  };

  rawClient.from = (relation: string) => {
    const builder = originalFrom(relation);

    if (relation === "credit_card_monthly_records") {
      return new Proxy(builder, {
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver);
          if (property !== "select" || typeof value !== "function") {
            return typeof value === "function" ? value.bind(target) : value;
          }
          return (...args: unknown[]) => wrapMonthlyReadBuilder(value.apply(target, args), state);
        },
      });
    }

    if (relation !== "debts") return builder;

    return new Proxy(builder, {
      get(target, property, receiver) {
        const original = Reflect.get(target, property, receiver);
        if ((property !== "insert" && property !== "update") || typeof original !== "function") {
          return typeof original === "function" ? original.bind(target) : original;
        }

        return (value: unknown, ...args: unknown[]) => {
          if (!value || typeof value !== "object" || Array.isArray(value)) return original.call(target, value, ...args);
          const record = value as RecordValue;
          const isInsertCard = property === "insert" && String(record.category ?? "").toLowerCase() === "credit card";

          return deferredMutation(async (calls) => {
            const cardId = String(record.id ?? findEqValue(calls, "id") ?? crypto.randomUUID());
            const isLikelyCardUpdate = property === "update" && Boolean(cardId);
            if (!isInsertCard && !isLikelyCardUpdate) return replay(original.call(target, value, ...args), calls);

            if (property === "insert") {
              const payload = cardPayloadFrom(record);
              const encrypted = await encryptCreditCardPayload(state.vaultKey, state.userId, cardId, payload);
              const sanitized = stripCardPrivateFields({
                ...record,
                id: cardId,
                user_id: state.userId,
                encrypted_payload: encrypted,
                encryption_version: 1,
                e2ee_revision: 0,
              });
              const result = await replay(original.call(target, sanitized, ...args), calls, { skipCategoryFilter: true });
              if (result?.error) return result;
              if (Array.isArray(result?.data)) return { ...result, data: result.data.map((row: any) => restoredCardRow(row, payload)) };
              return result?.data ? { ...result, data: restoredCardRow(result.data, payload) } : result;
            }

            let loaded;
            try {
              loaded = await loadCard(originalFrom, state, cardId);
            } catch {
              return replay(original.call(target, value, ...args), calls);
            }
            const current = loaded.payload;
            const revision = finite(loaded.row.e2ee_revision);

            const isStatementUpdate = "statement_balance" in record || "statement_date" in record || "payment_due_date" in record;
            if (isStatementUpdate) {
              const statementBalance = round(record.statement_balance);
              const statementBalanceEur = round(record.statement_balance_eur);
              const minimum = finite(record.minimum_payment, creditCardMinimumPayment(current.current_balance));
              const minimumEur = finite(record.minimum_payment_eur, creditCardMinimumPayment(current.current_balance_eur));
              const statementDate = String(record.statement_date ?? current.statement_date ?? "");
              const paymentDueDate = String(record.payment_due_date ?? current.payment_due_date ?? "");
              const updatedPayload: CreditCardPrivatePayloadV1 = {
                ...current,
                statement_balance: statementBalance,
                statement_balance_eur: statementBalanceEur,
                minimum_payment: minimum,
                minimum_payment_eur: minimumEur,
                annual_interest_rate: finite(record.annual_interest_rate, current.annual_interest_rate),
                statement_date: statementDate,
                payment_due_date: paymentDueDate,
                interest_charged: round(record.interest_charged),
                interest_charged_eur: round(record.interest_charged_eur),
              };
              const newCardPayload = await encryptCreditCardPayload(state.vaultKey, state.userId, cardId, updatedPayload);
              const monthStart = `${statementDate.slice(0, 7)}-01`;
              const existingRecord = await originalFrom("credit_card_monthly_records")
                .select("id")
                .eq("debt_id", cardId)
                .eq("user_id", state.userId)
                .eq("month_start", monthStart)
                .maybeSingle();
              if (existingRecord.error) return existingRecord;
              const recordId = existingRecord.data?.id ?? crypto.randomUUID();
              const encryptedRecord = await encryptCreditCardMonthlyRecordPayload(state.vaultKey, state.userId, recordId, {
                currency: current.currency,
                statement_balance: statementBalance,
                statement_balance_eur: statementBalanceEur,
                minimum_payment: minimum,
                minimum_payment_eur: minimumEur,
                interest_charged: updatedPayload.interest_charged,
                interest_charged_eur: updatedPayload.interest_charged_eur,
                statement_date: statementDate,
                payment_due_date: paymentDueDate,
              });
              const atomic = await originalRpc("save_credit_card_monthly_record_e2ee_atomic", {
                p_debt_id: cardId,
                p_expected_revision: revision,
                p_record_id: recordId,
                p_month_start: monthStart,
                p_statement_date: statementDate,
                p_payment_due_date: paymentDueDate,
                p_record_payload: encryptedRecord,
                p_new_card_payload: newCardPayload,
              });
              if (atomic.error) return atomic;
              return { data: restoredCardRow({ ...loaded.row, ...record, e2ee_revision: revision + 1 }, updatedPayload), error: null };
            }

            const mergedPayload: CreditCardPrivatePayloadV1 = {
              ...current,
              name: typeof record.name === "string" ? record.name : current.name,
              lender: "lender" in record ? (typeof record.lender === "string" ? record.lender : null) : current.lender,
              description: "description" in record ? (typeof record.description === "string" ? record.description : null) : current.description,
              card_last_four: "card_last_four" in record ? (typeof record.card_last_four === "string" ? record.card_last_four : null) : current.card_last_four,
              credit_limit: "credit_limit" in record ? finite(record.credit_limit) : current.credit_limit,
              credit_limit_eur: "credit_limit_eur" in record ? finite(record.credit_limit_eur) : current.credit_limit_eur,
              annual_interest_rate: "annual_interest_rate" in record ? finite(record.annual_interest_rate) : current.annual_interest_rate,
            };
            const encrypted = await encryptCreditCardPayload(state.vaultKey, state.userId, cardId, mergedPayload);
            const operational: RecordValue = {
              ...record,
              encrypted_payload: encrypted,
              encryption_version: 1,
              e2ee_revision: revision + 1,
              debt_kind: "credit_card",
            };
            const sanitized = stripCardPrivateFields(operational);
            let mutation = original.call(target, sanitized, ...args).eq("e2ee_revision", revision);
            const result = await replay(mutation, calls, { skipCategoryFilter: true });
            if (result?.error) return result;
            if (Array.isArray(result?.data)) return { ...result, data: result.data.map((row: any) => restoredCardRow(row, mergedPayload)) };
            return result?.data ? { ...result, data: restoredCardRow(result.data, mergedPayload) } : result;
          });
        };
      },
    });
  };

  rawClient.rpc = (fn: string, args?: Record<string, unknown>, options?: unknown) => {
    const supported = new Set([
      "record_credit_card_activity",
      "reverse_credit_card_activity",
      "save_credit_card_monthly_record",
      "record_credit_card_payment",
      "reverse_debt_payment",
    ]);
    if (!supported.has(fn)) return originalRpc(fn, args, options);

    return (async () => {
      if (fn === "record_credit_card_activity") {
        const cardId = String(args?.p_debt_id ?? "");
        const { row, payload: current } = await loadCard(originalFrom, state, cardId);
        const amount = round(args?.p_amount);
        const amountEur = round(args?.p_amount_eur);
        const rate = finite(args?.p_exchange_rate, 1);
        const type = String(args?.p_activity_type ?? "");
        const direction = type === "refund" || type === "adjustment_decrease" ? -1 : 1;
        const effect = round(amount * direction);
        const effectEur = round(amountEur * direction);
        const nextBalance = round(current.current_balance + effect);
        const nextBalanceEur = round(current.current_balance_eur + effectEur);
        if (amount <= 0 || amountEur <= 0 || rate <= 0 || nextBalance < 0 || nextBalanceEur < 0) return { data: null, error: new Error("Invalid Credit Card activity.") };

        const updated: CreditCardPrivatePayloadV1 = {
          ...current,
          current_balance: nextBalance,
          current_balance_eur: nextBalanceEur,
          exchange_rate_to_eur: rate,
          minimum_payment: creditCardMinimumPayment(nextBalance),
          minimum_payment_eur: creditCardMinimumPayment(nextBalanceEur),
          interest_charged: type === "interest" ? round(current.interest_charged + amount) : current.interest_charged,
          interest_charged_eur: type === "interest" ? round(current.interest_charged_eur + amountEur) : current.interest_charged_eur,
        };
        const activityId = crypto.randomUUID();
        const [cardCipher, activityCipher] = await Promise.all([
          encryptCreditCardPayload(state.vaultKey, state.userId, cardId, updated),
          encryptCreditCardActivityPayload(state.vaultKey, state.userId, activityId, {
            activity_type: type as any,
            description: String(args?.p_description ?? ""),
            amount,
            currency: current.currency,
            amount_eur: amountEur,
            exchange_rate_to_eur: rate,
            balance_effect: effect,
            balance_effect_eur: effectEur,
            notes: typeof args?.p_notes === "string" && args.p_notes.trim() ? args.p_notes.trim() : null,
          }),
        ]);
        const occurredAt = String(args?.p_occurred_at ?? new Date().toISOString());
        const atomic = await originalRpc("record_credit_card_activity_e2ee_atomic", {
          p_debt_id: cardId,
          p_expected_revision: finite(row.e2ee_revision),
          p_new_card_payload: cardCipher,
          p_activity_id: activityId,
          p_activity_payload: activityCipher,
          p_occurred_at: occurredAt,
        });
        if (atomic.error) return atomic;
        return {
          data: {
            debt: restoredCardRow({ ...row, e2ee_revision: finite(row.e2ee_revision) + 1, status: "active" }, updated),
            activity: {
              id: activityId, debt_id: cardId, user_id: state.userId,
              activity_type: type, description: String(args?.p_description ?? ""), amount,
              currency: current.currency, amount_eur: amountEur, exchange_rate_to_eur: rate,
              balance_effect: effect, balance_effect_eur: effectEur, occurred_at: occurredAt,
              notes: typeof args?.p_notes === "string" && args.p_notes.trim() ? args.p_notes.trim() : null,
              created_at: new Date().toISOString(), encryption_version: 1, encrypted_payload: activityCipher,
            },
          },
          error: null,
        };
      }

      if (fn === "reverse_credit_card_activity") {
        const activityId = String(args?.p_activity_id ?? "");
        const activity = await loadActivity(originalFrom, state, activityId);
        const card = await loadCard(originalFrom, state, String(activity.row.debt_id));
        if (activity.payload.activity_type === "statement_adjustment") return { data: null, error: new Error("Confirmed statement reconciliation cannot be reversed directly.") };
        const restoredBalance = round(card.payload.current_balance - activity.payload.balance_effect);
        const restoredBalanceEur = round(card.payload.current_balance_eur - activity.payload.balance_effect_eur);
        const restored: CreditCardPrivatePayloadV1 = {
          ...card.payload,
          current_balance: restoredBalance,
          current_balance_eur: restoredBalanceEur,
          minimum_payment: creditCardMinimumPayment(restoredBalance),
          minimum_payment_eur: creditCardMinimumPayment(restoredBalanceEur),
          interest_charged: activity.payload.activity_type === "interest" ? Math.max(0, round(card.payload.interest_charged - activity.payload.amount)) : card.payload.interest_charged,
          interest_charged_eur: activity.payload.activity_type === "interest" ? Math.max(0, round(card.payload.interest_charged_eur - activity.payload.amount_eur)) : card.payload.interest_charged_eur,
        };
        if (restored.current_balance < 0 || restored.current_balance_eur < 0) return { data: null, error: new Error("This activity cannot be reversed after later payments reduced the balance.") };
        const cipher = await encryptCreditCardPayload(state.vaultKey, state.userId, card.row.id, restored);
        const atomic = await originalRpc("reverse_credit_card_activity_e2ee_atomic", {
          p_activity_id: activityId,
          p_expected_revision: finite(card.row.e2ee_revision),
          p_restored_card_payload: cipher,
        });
        if (atomic.error) return atomic;
        return { data: { debt: restoredCardRow({ ...card.row, e2ee_revision: finite(card.row.e2ee_revision) + 1 }, restored), activity: { ...activity.row, ...activity.payload } }, error: null };
      }

      if (fn === "save_credit_card_monthly_record") {
        const cardId = String(args?.p_debt_id ?? "");
        const card = await loadCard(originalFrom, state, cardId);
        const statementDate = String(args?.p_statement_date ?? "");
        const dueDate = String(args?.p_payment_due_date ?? "");
        const statement = round(args?.p_statement_balance);
        const statementEur = round(args?.p_statement_balance_eur);
        const minimum = finite(args?.p_minimum_payment, creditCardMinimumPayment(statement));
        const minimumEur = finite(args?.p_minimum_payment_eur, creditCardMinimumPayment(statementEur));
        const interest = round(args?.p_interest_charged);
        const interestEur = round(args?.p_interest_charged_eur);
        const monthStart = `${statementDate.slice(0, 7)}-01`;
        const existing = await originalFrom("credit_card_monthly_records").select("id").eq("debt_id", cardId).eq("user_id", state.userId).eq("month_start", monthStart).maybeSingle();
        if (existing.error) return existing;
        const recordId = existing.data?.id ?? crypto.randomUUID();
        const cipher = await encryptCreditCardMonthlyRecordPayload(state.vaultKey, state.userId, recordId, {
          currency: card.payload.currency,
          statement_balance: statement,
          statement_balance_eur: statementEur,
          minimum_payment: minimum,
          minimum_payment_eur: minimumEur,
          interest_charged: interest,
          interest_charged_eur: interestEur,
          statement_date: statementDate,
          payment_due_date: dueDate,
        });
        const atomic = await originalRpc("save_credit_card_monthly_record_e2ee_atomic", {
          p_debt_id: cardId,
          p_expected_revision: finite(card.row.e2ee_revision),
          p_record_id: recordId,
          p_month_start: monthStart,
          p_statement_date: statementDate,
          p_payment_due_date: dueDate,
          p_record_payload: cipher,
          p_new_card_payload: null,
        });
        if (atomic.error) return atomic;
        return { data: { id: recordId, debt_id: cardId, user_id: state.userId, month_start: monthStart, currency: card.payload.currency, statement_balance: statement, statement_balance_eur: statementEur, minimum_payment: minimum, minimum_payment_eur: minimumEur, interest_charged: interest, interest_charged_eur: interestEur, statement_date: statementDate, payment_due_date: dueDate, encrypted_payload: cipher, encryption_version: 1 }, error: null };
      }

      if (fn === "record_credit_card_payment") {
        const cardId = String(args?.p_debt_id ?? "");
        const card = await loadCard(originalFrom, state, cardId);
        const amount = round(args?.p_amount);
        const amountEur = round(args?.p_amount_eur);
        const rate = finite(args?.p_exchange_rate, 1);
        if (amount <= 0 || amount > card.payload.current_balance || amountEur <= 0 || rate <= 0) return { data: null, error: new Error("Enter a valid payment not greater than the current balance.") };
        const paidAt = String(args?.p_paid_at ?? new Date().toISOString());
        const rateDate = String(args?.p_exchange_rate_date ?? paidAt.slice(0, 10));
        const nextBalance = Math.max(0, round(card.payload.current_balance - amount));
        const nextBalanceEur = Math.max(0, round(card.payload.current_balance_eur - amountEur));
        const updated: CreditCardPrivatePayloadV1 = {
          ...card.payload,
          current_balance: nextBalance,
          current_balance_eur: nextBalanceEur,
          exchange_rate_to_eur: rate,
          minimum_payment: creditCardMinimumPayment(nextBalance),
          minimum_payment_eur: creditCardMinimumPayment(nextBalanceEur),
        };
        const paymentId = crypto.randomUUID();
        const transactionId = crypto.randomUUID();
        const notes = typeof args?.p_notes === "string" && args.p_notes.trim() ? args.p_notes.trim() : null;
        const [cardCipher, paymentCipher, transactionCipher] = await Promise.all([
          encryptCreditCardPayload(state.vaultKey, state.userId, cardId, updated),
          encryptDebtPaymentPayload(state.vaultKey, state.userId, paymentId, { amount, currency: card.payload.currency, amount_eur: amountEur, exchange_rate_to_eur: rate, notes }),
          encryptTransactionPayload(state.vaultKey, state.userId, {
            description: `Credit card payment · ${card.payload.name}`,
            amount, currency: card.payload.currency, amount_eur: amountEur,
            exchange_rate_to_eur: rate, exchange_rate_date: rateDate,
            exchange_rate_source: "Credit card payment conversion",
            type: "expense", category: "Credit-card payment",
            transaction_date: rateDate, occurred_at: paidAt,
          }),
        ]);
        const atomic = await originalRpc("record_credit_card_payment_e2ee_atomic", {
          p_debt_id: cardId,
          p_expected_revision: finite(card.row.e2ee_revision),
          p_new_card_payload: cardCipher,
          p_payment_id: paymentId,
          p_payment_payload: paymentCipher,
          p_transaction_id: transactionId,
          p_transaction_payload: transactionCipher,
          p_paid_at: paidAt,
        });
        if (atomic.error) return atomic;
        return {
          data: {
            debt: restoredCardRow({ ...card.row, e2ee_revision: finite(card.row.e2ee_revision) + 1 }, updated),
            payment: { id: paymentId, debt_id: cardId, user_id: state.userId, amount, currency: card.payload.currency, amount_eur: amountEur, exchange_rate_to_eur: rate, paid_at: paidAt, notes, transaction_id: transactionId, created_at: new Date().toISOString(), encrypted_payload: paymentCipher, encryption_version: 1 },
          },
          error: null,
        };
      }

      const paymentId = String(args?.p_payment_id ?? "");
      let payment;
      try { payment = await loadPayment(originalFrom, state, paymentId); } catch { return originalRpc(fn, args, options); }
      let card;
      try { card = await loadCard(originalFrom, state, String(payment.row.debt_id)); } catch { return originalRpc(fn, args, options); }
      const restoredBalance = round(card.payload.current_balance + payment.payload.amount);
      const restoredBalanceEur = round(card.payload.current_balance_eur + payment.payload.amount_eur);
      const restored: CreditCardPrivatePayloadV1 = {
        ...card.payload,
        current_balance: restoredBalance,
        current_balance_eur: restoredBalanceEur,
        minimum_payment: creditCardMinimumPayment(restoredBalance),
        minimum_payment_eur: creditCardMinimumPayment(restoredBalanceEur),
      };
      const cipher = await encryptCreditCardPayload(state.vaultKey, state.userId, card.row.id, restored);
      const atomic = await originalRpc("reverse_credit_card_payment_e2ee_atomic", {
        p_payment_id: paymentId,
        p_expected_revision: finite(card.row.e2ee_revision),
        p_restored_card_payload: cipher,
      });
      if (atomic.error) return atomic;
      return { data: { debt: restoredCardRow({ ...card.row, e2ee_revision: finite(card.row.e2ee_revision) + 1, status: "active" }, restored), payment: { ...payment.row, ...payment.payload }, deleted_transaction_count: payment.row.transaction_id ? 1 : 0, deleted_transaction_id: payment.row.transaction_id }, error: null };
    })();
  };
}
