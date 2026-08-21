import type { createClient } from "@/lib/supabase/client";
import {
  decryptBillPayload,
  type EncryptedBillRow,
} from "@/lib/e2ee/billPayload";
import { encryptTransactionPayload } from "@/lib/e2ee/transactionPayload";

type BrowserClient = ReturnType<typeof createClient>;

type PendingTransaction = {
  id: string;
};

type BillSource = EncryptedBillRow & {
  due_date: string;
  paid_at: string | null;
  transaction_id: string | null;
};

type BillRunSource = {
  source_id: string;
  scheduled_for: string;
  transaction_id: string | null;
  trigger_mode: string;
};

const TRANSACTION_PLAINTEXT_CLEAR = {
  description: null,
  amount: null,
  currency: null,
  amount_eur: null,
  exchange_rate_to_eur: null,
  exchange_rate_date: null,
  exchange_rate_source: null,
  type: null,
  category: null,
  transaction_date: null,
  occurred_at: null,
} as const;

function dateKey(value: string | null | undefined): string {
  const text = value ?? "";
  return text ? text.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

export async function finalizePendingEncryptedBillTransactions(
  supabase: BrowserClient,
  vaultKey: CryptoKey,
  userId: string,
): Promise<number> {
  const { data: pendingData, error: pendingError } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("encryption_version", 0)
    .is("encrypted_payload", null)
    .limit(1000);

  if (pendingError) throw pendingError;

  const pending = (pendingData ?? []) as PendingTransaction[];
  if (!pending.length) return 0;

  const transactionIds = pending.map((row) => row.id);

  const [directBillsResult, runsResult] = await Promise.all([
    (supabase.from("bills") as any)
      .select(
        "id,user_id,encrypted_payload,encryption_version,due_date,paid_at,transaction_id",
      )
      .eq("user_id", userId)
      .eq("encryption_version", 1)
      .not("encrypted_payload", "is", null)
      .in("transaction_id", transactionIds),
    supabase
      .from("automatic_payment_runs")
      .select("source_id,scheduled_for,transaction_id,trigger_mode")
      .eq("user_id", userId)
      .eq("source_type", "bill")
      .in("transaction_id", transactionIds),
  ]);

  const firstError = directBillsResult.error ?? runsResult.error;
  if (firstError) throw firstError;

  const directBills = (directBillsResult.data ?? []) as BillSource[];
  const runs = (runsResult.data ?? []) as BillRunSource[];
  const runBillIds = [...new Set(runs.map((run) => run.source_id))];

  const recurringBillsResult = runBillIds.length
    ? await (supabase.from("bills") as any)
        .select(
          "id,user_id,encrypted_payload,encryption_version,due_date,paid_at,transaction_id",
        )
        .eq("user_id", userId)
        .eq("encryption_version", 1)
        .not("encrypted_payload", "is", null)
        .in("id", runBillIds)
    : { data: [], error: null };

  if (recurringBillsResult.error) throw recurringBillsResult.error;

  const directByTransaction = new Map(
    directBills
      .filter((bill) => bill.transaction_id)
      .map((bill) => [bill.transaction_id as string, bill]),
  );
  const recurringById = new Map(
    ((recurringBillsResult.data ?? []) as BillSource[]).map((bill) => [
      bill.id,
      bill,
    ]),
  );
  const runByTransaction = new Map(
    runs
      .filter((run) => run.transaction_id)
      .map((run) => [run.transaction_id as string, run]),
  );

  let finalized = 0;

  for (const transaction of pending) {
    const run = runByTransaction.get(transaction.id);
    const bill = run
      ? recurringById.get(run.source_id)
      : directByTransaction.get(transaction.id);

    if (!bill) continue;

    const privatePayload = await decryptBillPayload(
      vaultKey,
      userId,
      bill,
    );

    const transactionDate = run
      ? dateKey(run.scheduled_for)
      : dateKey(bill.paid_at ?? bill.due_date);
    const occurredAt = run
      ? run.scheduled_for
      : bill.paid_at ?? `${transactionDate}T12:00:00.000Z`;
    const description = run
      ? privatePayload.company
        ? `${privatePayload.name} · ${privatePayload.company}`
        : privatePayload.name
      : `Bill payment · ${privatePayload.name}`;

    const encryptedPayload = await encryptTransactionPayload(
      vaultKey,
      userId,
      {
        description,
        amount: privatePayload.amount,
        currency: privatePayload.currency,
        amount_eur: privatePayload.amount_eur,
        exchange_rate_to_eur: privatePayload.exchange_rate_to_eur,
        exchange_rate_date: transactionDate,
        exchange_rate_source:
          run?.trigger_mode === "automatic"
            ? "Automatic bill schedule"
            : run
              ? "Bill conversion"
              : "Bill payment conversion",
        type: "expense",
        category: privatePayload.category,
        transaction_date: transactionDate,
        occurred_at: occurredAt,
      },
    );

    const { error } = await supabase
      .from("transactions")
      .update({
        encrypted_payload: encryptedPayload,
        encryption_version: 1,
        ...TRANSACTION_PLAINTEXT_CLEAR,
      })
      .eq("id", transaction.id)
      .eq("user_id", userId)
      .eq("encryption_version", 0);

    if (error) throw error;
    finalized += 1;
  }

  return finalized;
}
