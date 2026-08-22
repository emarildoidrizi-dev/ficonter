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

type BoundaryState = {
  vaultKey: CryptoKey;
  userId: string;
};

type DeferredCall = {
  property: PropertyKey;
  args: unknown[];
};

function debtPrivatePayload(
  record: Record<string, unknown>,
): DebtPrivatePayloadV1 {
  return {
    name: String(record.name ?? ""),
    lender: typeof record.lender === "string" ? record.lender : null,
    description:
      typeof record.description === "string" ? record.description : null,
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

function deferredMutation(
  execute: (calls: DeferredCall[]) => Promise<unknown>,
): any {
  const calls: DeferredCall[] = [];
  let promise: Promise<unknown> | null = null;
  const run = () => (promise ??= execute(calls));

  const proxy = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") return run().then.bind(run());
        if (property === "catch") return run().catch.bind(run());
        if (property === "finally") return run().finally.bind(run());

        return (...args: unknown[]) => {
          calls.push({ property, args });
          return proxy;
        };
      },
    },
  );

  return proxy;
}

function replayBuilder(builder: any, calls: DeferredCall[]) {
  let current = builder;

  for (const call of calls) {
    const method = current?.[call.property as any];
    if (typeof method !== "function") {
      throw new Error(
        `Unsupported Supabase mutation step: ${String(call.property)}`,
      );
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

export function installDebtE2eeBoundary(
  client: any,
  vaultKey: CryptoKey,
  userId: string,
) {
  const rawClient = client as any;
  const existingState = rawClient.__ficonterDebtBoundaryState as
    | BoundaryState
    | undefined;

  if (existingState) {
    existingState.vaultKey = vaultKey;
    existingState.userId = userId;
    return;
  }

  const state: BoundaryState = { vaultKey, userId };
  rawClient.__ficonterDebtBoundaryState = state;

  const originalFrom = rawClient.from.bind(rawClient);
  const originalRpc = rawClient.rpc.bind(rawClient);

  rawClient.from = (relation: string) => {
    const builder = originalFrom(relation);
    if (relation !== "debts") return builder;

    return new Proxy(builder, {
      get(target, property, receiver) {
        const original = Reflect.get(target, property, receiver);

        if (
          (property !== "insert" && property !== "update") ||
          typeof original !== "function"
        ) {
          return typeof original === "function"
            ? original.bind(target)
            : original;
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
            const debtId = String(
              record.id ?? findEqValue(calls, "id") ?? crypto.randomUUID(),
            );

            const encryptedPayload = await encryptDebtPayload(
              state.vaultKey,
              state.userId,
              debtId,
              debtPrivatePayload(record),
            );

            let revision = 0;

            if (property === "update") {
              const { data: existing, error: revisionError } =
                await originalFrom("debts")
                  .select("e2ee_revision")
                  .eq("id", debtId)
                  .eq("user_id", state.userId)
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
  };

  rawClient.rpc = (
    fn: string,
    args?: Record<string, unknown>,
    options?: unknown,
  ) => {
    if (fn !== "record_debt_payment_atomic" && fn !== "reverse_debt_payment") {
      return originalRpc(fn, args, options);
    }

    return (async () => {
      if (fn === "record_debt_payment_atomic") {
        const debtId = String(args?.p_debt_id ?? "");
        const { data: row, error: debtError } = await originalFrom("debts")
          .select("*")
          .eq("id", debtId)
          .eq("user_id", state.userId)
          .single();

        if (debtError || !row) {
          return {
            data: null,
            error: debtError ?? new Error("Debt not found."),
          };
        }

        if (String(row.category ?? "").toLowerCase() === "credit card") {
          return originalRpc(fn, args, options);
        }

        if (row.encryption_version !== 1 || !row.encrypted_payload) {
          return {
            data: null,
            error: new Error(
              "Debt encryption is not ready yet. Refresh after unlocking your Financial Vault.",
            ),
          };
        }

        const current = await decryptDebtPayload(
          state.vaultKey,
          state.userId,
          row,
        );

        const amount = Number(args?.p_amount ?? 0);
        const amountEur = Number(args?.p_amount_eur ?? 0);
        const rate = Number(args?.p_exchange_rate ?? 0);
        const paidAt = String(args?.p_paid_at ?? "");
        const rateDate = String(
          args?.p_exchange_rate_date ?? paidAt.slice(0, 10),
        );
        const notes = String(args?.p_notes ?? "").trim();

        if (
          !(amount > 0) ||
          amount > current.current_balance ||
          !(amountEur > 0) ||
          !(rate > 0)
        ) {
          return { data: null, error: new Error("Invalid Debt payment.") };
        }

        const updated: DebtPrivatePayloadV1 = {
          ...current,
          current_balance: Math.max(0, current.current_balance - amount),
          current_balance_eur: Math.max(
            0,
            current.current_balance_eur - amountEur,
          ),
        };

        const newStatus =
          updated.current_balance === 0
            ? "paid_off"
            : String(row.status ?? "active");

        const paymentId = crypto.randomUUID();
        const transactionId = crypto.randomUUID();

        const newDebtPayload = await encryptDebtPayload(
          state.vaultKey,
          state.userId,
          debtId,
          updated,
        );

        const paymentPayload = await encryptDebtPaymentPayload(
          state.vaultKey,
          state.userId,
          paymentId,
          {
            amount,
            currency: current.currency,
            amount_eur: amountEur,
            exchange_rate_to_eur: rate,
            notes: notes || null,
          },
        );

        const transactionPayload = await encryptTransactionPayload(
          state.vaultKey,
          state.userId,
          {
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
          },
        );

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
            debt: {
              ...row,
              ...updated,
              status: newStatus,
              e2ee_revision: Number(row.e2ee_revision ?? 0) + 1,
            },
            payment: {
              id: paymentId,
              debt_id: debtId,
              user_id: state.userId,
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
      const { data: paymentRow, error: paymentError } = await originalFrom(
        "debt_payments",
      )
        .select("*")
        .eq("id", paymentId)
        .eq("user_id", state.userId)
        .single();

      if (paymentError || !paymentRow) {
        return {
          data: null,
          error: paymentError ?? new Error("Payment not found."),
        };
      }

      const { data: debtRow, error: debtError } = await originalFrom("debts")
        .select("*")
        .eq("id", paymentRow.debt_id)
        .eq("user_id", state.userId)
        .single();

      if (debtError || !debtRow) {
        return {
          data: null,
          error: debtError ?? new Error("Debt not found."),
        };
      }

      if (String(debtRow.category ?? "").toLowerCase() === "credit card") {
        return originalRpc(fn, args, options);
      }

      if (
        paymentRow.encryption_version !== 1 ||
        !paymentRow.encrypted_payload ||
        debtRow.encryption_version !== 1 ||
        !debtRow.encrypted_payload
      ) {
        return {
          data: null,
          error: new Error("Encrypted Debt payment data is not ready yet."),
        };
      }

      const payment = await decryptDebtPaymentPayload(
        state.vaultKey,
        state.userId,
        paymentRow,
      );
      const debt = await decryptDebtPayload(
        state.vaultKey,
        state.userId,
        debtRow,
      );

      const restored: DebtPrivatePayloadV1 = {
        ...debt,
        current_balance: Math.min(
          debt.original_balance,
          debt.current_balance + payment.amount,
        ),
        current_balance_eur: Math.min(
          debt.original_balance_eur,
          debt.current_balance_eur + payment.amount_eur,
        ),
      };

      const restoredStatus =
        debtRow.status === "paid_off"
          ? "active"
          : String(debtRow.status ?? "active");

      const restoredPayload = await encryptDebtPayload(
        state.vaultKey,
        state.userId,
        debtRow.id,
        restored,
      );

      const atomic = await originalRpc("reverse_debt_payment_e2ee_atomic", {
        p_payment_id: paymentId,
        p_expected_revision: Number(debtRow.e2ee_revision ?? 0),
        p_restored_debt_payload: restoredPayload,
        p_restored_status: restoredStatus,
      });

      if (atomic.error) return atomic;

      return {
        data: {
          debt: {
            ...debtRow,
            ...restored,
            status: restoredStatus,
            e2ee_revision: Number(debtRow.e2ee_revision ?? 0) + 1,
          },
        },
        error: null,
      };
    })();
  };
}
