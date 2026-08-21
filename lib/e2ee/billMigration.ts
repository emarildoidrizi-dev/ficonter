import type { SupabaseClient } from "@supabase/supabase-js";

import {
  encryptBillPayload,
  type BillPrivatePayloadV1,
} from "@/lib/e2ee/billPayload";

type LegacyBillRow = {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  category: string;
  amount: number | string;
  currency: string;
  amount_eur: number | string;
  exchange_rate_to_eur: number | string;
  payment_method: string | null;
  notes: string | null;
  encrypted_payload: unknown | null;
  encryption_version: number | null;
};

export async function migrateLegacyPlaintextBills(
  supabase: SupabaseClient,
  vaultKey: CryptoKey,
  userId: string,
): Promise<number> {
  const billsTable = supabase.from("bills") as any;

  const { data, error } = await billsTable
    .select(
      "id,user_id,name,company,category,amount,currency,amount_eur,exchange_rate_to_eur,payment_method,notes,encrypted_payload,encryption_version",
    )
    .eq("user_id", userId);

  if (error) throw error;

  let migrated = 0;

  for (const row of (data ?? []) as LegacyBillRow[]) {
    if (row.user_id !== userId) continue;

    if (
      row.encryption_version === 1 &&
      row.encrypted_payload
    ) {
      continue;
    }

    const payload: BillPrivatePayloadV1 = {
      name: row.name,
      company: row.company,
      category: row.category,
      amount: Number(row.amount),
      currency: row.currency,
      amount_eur: Number(row.amount_eur),
      exchange_rate_to_eur: Number(
        row.exchange_rate_to_eur,
      ),
      payment_method: row.payment_method,
      notes: row.notes,
    };

    const encryptedPayload =
      await encryptBillPayload(
        vaultKey,
        userId,
        row.id,
        payload,
      );

    const { error: updateError } =
      await billsTable
        .update({
          encrypted_payload: encryptedPayload,
          encryption_version: 1,
        })
        .eq("id", row.id)
        .eq("user_id", userId);

    if (updateError) throw updateError;

    migrated += 1;
  }

  return migrated;
}