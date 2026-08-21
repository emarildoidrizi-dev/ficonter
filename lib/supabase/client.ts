import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.contract";
import { getActiveVaultKey } from "@/lib/e2ee/sessionKey";
import {
  decryptDebtPayload,
  encryptDebtPayload,
  type DebtPrivatePayloadV1,
} from "@/lib/e2ee/debtPayload";
import {
  decryptDebtPaymentPayload,
  encryptDebtPaymentPayload,
} from "@/lib/e2ee/debtPaymentPayload";
import { encryptTransactionPayload } from "@/lib/e2ee/transactionPayload";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const TRUST_COOKIE = "ficonter_trusted_device";

const BILL_PRIVATE_FIELDS = [
  "name",
  "company",
  "category",
  "amount",
  "currency",
  "amount_eur",
  "exchange_rate_to_eur",
  "payment_method",
  "notes",
] as const;

function readTrustedDevicePreference(): boolean {
  if (typeof document === "undefined") return false;
  const cookies = document.cookie.split(";").map((part) => part.trim());
  return cookies.includes(`${TRUST_COOKIE}=1`);
}

export function saveTrustedDevicePreference(keepSignedIn: boolean): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  if (keepSignedIn) {
    document.cookie =
      `${TRUST_COOKIE}=1; Path=/; Max-Age=${ONE_YEAR_SECONDS}; ` +
      `SameSite=Lax${secure}`;
  } else {
    document.cookie =
      `${TRUST_COOKIE}=0; Path=/; SameSite=Lax${secure}`;
  }
}

function createConfiguredBrowserClient(
  url: string,
  key: string,
  keepSignedIn: boolean,
) {
  return createBrowserClient<Database>(url, key, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      ...(keepSignedIn ? { maxAge: ONE_YEAR_SECONDS } : {}),
    },
  });
}

type BrowserClient = ReturnType<typeof createConfiguredBrowserClient>;
const clientCache = new Map<boolean, BrowserClient>();

function sanitizeEncryptedBillValue(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (record.encryption_version !== 1 || !record.encrypted_payload) return value;
  const sanitized: Record<string, unknown> = { ...record };
  for (const field of BILL_PRIVATE_FIELDS) sanitized[field] = null;
  return sanitized;
}

function sanitizeEncryptedBillWrite(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map((item) => sanitizeEncryptedBillValue(item))
    : sanitizeEncryptedBillValue(value);
}

function debtPrivatePayload(record: Record<string, unknown>): DebtPrivatePayloadV1 {
  return {
    name: String(record.name ?? ""),
    lender: typeof record.lender === "string" ? record.lender : null,
    description: typeof record.description === "string" ? record.description : null,
    category: String(record.category ?? ""),
    original_balance: Number(record.original_balance ?? 0),
    current_balance: Number(record.current_balance ?? 0),
    currency: String(record.currency ?? "EUR"),
    original_balance_eur: Number(record.original_balance_eur ?? 0),
    current_balance_eur: Number(record.current_balance_eur ?? 0),
    exchange_rate_to_eur: Number(record.exchange_rate_to_eur ?? 1),
    annual_interest_rate: Number(record.annual_interest_rate ?? 0),
    minimum_payment: Number(record.minimum_payment ?? 0),
    minimum_payment_eur: Number(record.minimum_payment_eur ?? 0),
  };
}

type DeferredCall = { property: PropertyKey; args: unknown[] };

function deferredMutation(
  execute: (calls: DeferredCall[]) => Promise<unknown>,
): any {
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

function replayBuilder(builder: any, calls: DeferredCall[]) {
  let current = builder;
  for (const call of calls) {
    const method = current?.[call.property as keyof typeof current];
    if (typeof method !== "function") {
      throw new Error(`Unsupported Supabase mutation step: ${String(call.property)}`);
    }
    current = method.apply(current, call.args);
  }
  return current;
}

function findEqValue(calls: DeferredCall[], column: string): unknown {
  const match = calls.find(
    (call) => call.property === "eq" && call.args[0] === column,
  );
  return match?.args[1];
}

function addE2eeBoundaries(client: BrowserClient): BrowserClient {
  const rawClient = client as BrowserClient & {
    from: (relation: string) => any;
    rpc: (fn: string, args?: Record<string, unknown>, options?: unknown) => any;
    __ficonterE2eeBoundary?: boolean;
  };

  if (rawClient.__ficonterE2eeBoundary) return client;

  const originalFrom = rawClient.from.bind(client);
  const originalRpc = rawClient.rpc.bind(client);

  rawClient.from = ((relation: string) => {
    const builder = originalFrom(relation);

    if (relation === "bills") {
      return new Proxy(builder, {
        get(target, property, receiver) {
          const original = Reflect.get(target, property, receiver);
          if (
            (property === "insert" || property === "update" || property === "upsert") &&
            typeof original === "function"
          ) {
            return (value: unknown, ...args: unknown[]) =>
              original.call(target, sanitizeEncryptedBillWrite(value), ...args);
          }
          return typeof original === "function" ? original.bind(target) : original;
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
          if (!value || typeof value !== "object" || Array.isArray(value)) {
            return original.call(target, value, ...args);
          }

          const record = value as Record<string, unknown>;
          if (String(record.category ?? "").toLowerCase() === "credit card") {
            return original.call(target, value, ...args);
          }

          return deferredMutation(async (calls) => {
            const vaultKey = getActiveVaultKey();
            if (!vaultKey) {
              throw new Error("Unlock your Financial Vault before saving a Debt.");
            }

            const { data: { user }, error: userError } = await rawClient.auth.getUser();
            if (userError || !user) throw new Error("Please log in again.");

            const debtId = String(
              record.id ?? findEqValue(calls, "id") ?? crypto.randomUUID(),
            );
            const encryptedPayload = await encryptDebtPayload(
              vaultKey,
              user.id,
              debtId,
              debtPrivatePayload(record),
            );

            let revision = 0;
            if (property === "update") {
              const { data: existing, error: revisionError } = await originalFrom("debts")
                .select("e2ee_revision")
                .eq("id", debtId)
                .eq("user_id", user.id)
                .single();
              if (revisionError) throw revisionError;
              revision = Number(existing?.e2ee_revision ?? 0);
            }

            const enriched = {
              ...record,
              ...(property === "insert" ? { id: debtId } : {}),
              encrypted_payload: encryptedPayload,
              encryption_version: 1,
              e2ee_revision: property === "update" ? revision + 1 : 0,
            };

            let mutation = original.call(target, enriched, ...args);
            if (property === "update") {
              mutation = mutation.eq("e2ee_revision", revision);
            }
            return await replayBuilder(mutation, calls);
          });
        };
      },
    });
  }) as typeof rawClient.from;

  rawClient.rpc = ((fn: string, args?: Record<string, unknown>, options?: unknown) => {
    if (fn !== "record_debt_payment_atomic" && fn !== "reverse_debt_payment") {
      return originalRpc(fn, args, options as any);
    }

    return (async () => {
      const vaultKey = getActiveVaultKey();
      if (!vaultKey) {
        return { data: null, error: new Error("Unlock your Financial Vault before changing a Debt payment.") };
      }

      const { data: { user }, error: userError } = await rawClient.auth.getUser();
      if (userError || !user) return { data: null, error: userError ?? new Error("Please log in again.") };

      if (fn === "record_debt_payment_atomic") {
        const debtId = String(args?.p_debt_id ?? "");
        const { data: row, error: debtError } = await originalFrom("debts")
          .select("*")
          .eq("id", debtId)
          .eq("user_id", user.id)
          .single();
        if (debtError || !row) return { data: null, error: debtError ?? new Error("Debt not found.") };
        if (String(row.category ?? "").toLowerCase() === "credit card") {
          return originalRpc(fn, args, options as any);
        }
        if (row.encryption_version !== 1 || !row.encrypted_payload) {
          return { data: null, error: new Error("Debt encryption is not ready yet. Refresh after unlocking your Financial Vault.") };
        }

        const current = await decryptDebtPayload(vaultKey, user.id, row as any);
        const amount = Number(args?.p_amount ?? 0);
        const amountEur = Number(args?.p_amount_eur ?? 0);
        const rate = Number(args?.p_exchange_rate ?? 0);
        const paidAt = String(args?.p_paid_at ?? "");
        const rateDate = String(args?.p_exchange_rate_date ?? paidAt.slice(0, 10));
        const notes = String(args?.p_notes ?? "").trim();
        if (!(amount > 0) || amount > current.current_balance || !(amountEur > 0) || !(rate > 0)) {
          return { data: null, error: new Error("Invalid Debt payment.") };
        }

        const updated: DebtPrivatePayloadV1 = {
          ...current,
          current_balance: Math.max(0, current.current_balance - amount),
          current_balance_eur: Math.max(0, current.current_balance_eur - amountEur),
        };
        const newStatus = updated.current_balance === 0 ? "paid_off" : String(row.status ?? "active");
        const paymentId = crypto.randomUUID();
        const transactionId = crypto.randomUUID();
        const newDebtPayload = await encryptDebtPayload(vaultKey, user.id, debtId, updated);
        const paymentPayload = await encryptDebtPaymentPayload(vaultKey, user.id, paymentId, {
          amount,
          currency: current.currency,
          amount_eur: amountEur,
          exchange_rate_to_eur: rate,
          notes: notes || null,
        });
        const transactionPayload = await encryptTransactionPayload(vaultKey, user.id, {
          description: `Debt payment · ${current.name}`,
          amount,
          currency: current.currency,
          amount_eur: amountEur,
          exchange_rate_to_eur: rate,
          exchange_rate_date: rateDate,
          exchange_rate_source: "Debt payment conversion",
          type: "expense",
          category: "Debt repayment",
          transaction_date: rateDate,
          occurred_at: paidAt,
        });

        const atomic = await originalRpc("record_debt_payment_e2ee_atomic", {
          p_debt_id: debtId,
          p_expected_revision: Number(row.e2ee_revision ?? 0),
          p_new_debt_payload: newDebtPayload,
          p_new_status: newStatus,
          p_payment_id: paymentId,
          p_payment_payload: paymentPayload,
          p_transaction_id: transactionId,
          p_transaction_payload: transactionPayload,
          p_paid_at: paidAt,
        });
        if (atomic.error) return atomic;

        return {
          data: {
            debt: { ...row, ...updated, status: newStatus, e2ee_revision: Number(row.e2ee_revision ?? 0) + 1 },
            payment: {
              id: paymentId,
              debt_id: debtId,
              user_id: user.id,
              amount,
              currency: current.currency,
              amount_eur: amountEur,
              exchange_rate_to_eur: rate,
              paid_at: paidAt,
              notes: notes || null,
              transaction_id: transactionId,
              created_at: new Date().toISOString(),
            },
          },
          error: null,
        };
      }

      const paymentId = String(args?.p_payment_id ?? "");
      const { data: paymentRow, error: paymentError } = await originalFrom("debt_payments")
        .select("*")
        .eq("id", paymentId)
        .eq("user_id", user.id)
        .single();
      if (paymentError || !paymentRow) return { data: null, error: paymentError ?? new Error("Payment not found.") };
      const { data: debtRow, error: debtError } = await originalFrom("debts")
        .select("*")
        .eq("id", paymentRow.debt_id)
        .eq("user_id", user.id)
        .single();
      if (debtError || !debtRow) return { data: null, error: debtError ?? new Error("Debt not found.") };
      if (String(debtRow.category ?? "").toLowerCase() === "credit card") {
        return originalRpc(fn, args, options as any);
      }
      if (paymentRow.encryption_version !== 1 || !paymentRow.encrypted_payload || debtRow.encryption_version !== 1 || !debtRow.encrypted_payload) {
        return { data: null, error: new Error("Encrypted Debt payment data is not ready yet.") };
      }

      const payment = await decryptDebtPaymentPayload(vaultKey, user.id, paymentRow as any);
      const debt = await decryptDebtPayload(vaultKey, user.id, debtRow as any);
      const restored: DebtPrivatePayloadV1 = {
        ...debt,
        current_balance: Math.min(debt.original_balance, debt.current_balance + payment.amount),
        current_balance_eur: Math.min(debt.original_balance_eur, debt.current_balance_eur + payment.amount_eur),
      };
      const restoredStatus = debtRow.status === "paid_off" ? "active" : String(debtRow.status ?? "active");
      const restoredPayload = await encryptDebtPayload(vaultKey, user.id, debtRow.id, restored);
      const atomic = await originalRpc("reverse_debt_payment_e2ee_atomic", {
        p_payment_id: paymentId,
        p_expected_revision: Number(debtRow.e2ee_revision ?? 0),
        p_restored_debt_payload: restoredPayload,
        p_restored_status: restoredStatus,
      });
      if (atomic.error) return atomic;

      return {
        data: {
          debt: { ...debtRow, ...restored, status: restoredStatus, e2ee_revision: Number(debtRow.e2ee_revision ?? 0) + 1 },
        },
        error: null,
      };
    })();
  }) as typeof rawClient.rpc;

  rawClient.__ficonterE2eeBoundary = true;
  return client;
}

export function createClient(keepSignedInOverride?: boolean): BrowserClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables.");
  const keepSignedIn = keepSignedInOverride ?? readTrustedDevicePreference();
  const cached = clientCache.get(keepSignedIn);
  if (cached) return cached;
  const client = addE2eeBoundaries(
    createConfiguredBrowserClient(url, key, keepSignedIn),
  );
  clientCache.set(keepSignedIn, client);
  return client;
}
