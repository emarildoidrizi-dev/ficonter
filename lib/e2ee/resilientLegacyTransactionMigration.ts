import type { createClient } from "@/lib/supabase/client";
import { encryptTransactionPayload } from "@/lib/e2ee/transactionPayload";

type BrowserClient = ReturnType<typeof createClient>;

const PLAINTEXT_CLEAR = {
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

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function migrateLegacyPlaintextTransactionsResilient(
  supabase: BrowserClient,
  vaultKey: CryptoKey,
  userId: string,
): Promise<{ migrated: number; failed: number }> {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id,description,amount,currency,amount_eur,exchange_rate_to_eur,exchange_rate_date,exchange_rate_source,type,category,transaction_date,occurred_at",
    )
    .eq("user_id", userId)
    .is("encrypted_payload", null)
    .is("encryption_version", null)
    .limit(1000);

  if (error) throw error;

  let migrated = 0;
  let failed = 0;

  for (const row of data ?? []) {
    if (
      !row.description ||
      row.amount == null ||
      !row.currency ||
      row.amount_eur == null ||
      row.exchange_rate_to_eur == null ||
      !row.type ||
      !row.category ||
      !row.transaction_date
    ) {
      failed += 1;
      console.warn(`Skipped incomplete legacy transaction ${row.id}.`);
      continue;
    }

    try {
      const encryptedPayload = await encryptTransactionPayload(
        vaultKey,
        userId,
        {
          description: row.description,
          amount: numberValue(row.amount),
          currency: row.currency,
          amount_eur: numberValue(row.amount_eur),
          exchange_rate_to_eur: numberValue(row.exchange_rate_to_eur, 1),
          exchange_rate_date: row.exchange_rate_date,
          exchange_rate_source: row.exchange_rate_source,
          type: row.type,
          category: row.category,
          transaction_date: row.transaction_date,
          occurred_at: row.occurred_at,
        },
      );

      const { error: updateError } = await supabase
        .from("transactions")
        .update({
          encrypted_payload: encryptedPayload,
          encryption_version: 1,
          ...PLAINTEXT_CLEAR,
        })
        .eq("id", row.id)
        .eq("user_id", userId);

      if (updateError) throw updateError;
      migrated += 1;
    } catch (rowError) {
      failed += 1;
      console.warn(
        `Legacy transaction ${row.id} could not be migrated; continuing with the remaining rows.`,
        rowError,
      );
    }
  }

  return { migrated, failed };
}
