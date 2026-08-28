import type { SupabaseClient } from "@supabase/supabase-js";

import {
  encryptDebtPayload,
  type DebtPrivatePayloadV1,
} from "@/lib/e2ee/debtPayload";
import {
  encryptDebtPaymentPayload,
  type DebtPaymentPrivatePayloadV1,
} from "@/lib/e2ee/debtPaymentPayload";

type LegacyDebtRow = {
  id: string;
  user_id: string;
  name: string;
  lender: string | null;
  description: string | null;
  category: string;
  original_balance: number | string;
  current_balance: number | string;
  currency: string;
  original_balance_eur: number | string;
  current_balance_eur: number | string;
  exchange_rate_to_eur: number | string;
  annual_interest_rate: number | string;
  minimum_payment: number | string;
  minimum_payment_eur: number | string;
  encrypted_payload: unknown | null;
  encryption_version: number | null;
};

type LegacyDebtPaymentRow = {
  id: string;
  user_id: string;
  amount: number | string;
  currency: string;
  amount_eur: number | string;
  exchange_rate_to_eur: number | string;
  notes: string | null;
  encrypted_payload: unknown | null;
  encryption_version: number | null;
};

export async function migrateLegacyPlaintextDebts(
  supabase: SupabaseClient,
  vaultKey: CryptoKey,
  userId: string,
): Promise<number> {
  const debtsTable = supabase.from("debts") as any;

  const { data, error } = await debtsTable
    .select(
      "id,user_id,name,lender,description,category,original_balance,current_balance,currency,original_balance_eur,current_balance_eur,exchange_rate_to_eur,annual_interest_rate,minimum_payment,minimum_payment_eur,encrypted_payload,encryption_version",
    )
    .eq("user_id", userId);

  if (error) throw error;

  let migrated = 0;

  for (const row of (data ?? []) as LegacyDebtRow[]) {
    if (row.user_id !== userId) continue;
    if (row.encryption_version === 1 && row.encrypted_payload) continue;

    const payload: DebtPrivatePayloadV1 = {
      name: row.name,
      lender: row.lender,
      description: row.description,
      category: row.category,
      original_balance: Number(row.original_balance),
      current_balance: Number(row.current_balance),
      currency: row.currency,
      original_balance_eur: Number(row.original_balance_eur),
      current_balance_eur: Number(row.current_balance_eur),
      exchange_rate_to_eur: Number(row.exchange_rate_to_eur),
      annual_interest_rate: Number(row.annual_interest_rate),
      minimum_payment: Number(row.minimum_payment),
      minimum_payment_eur: Number(row.minimum_payment_eur),
    };

    const encryptedPayload = await encryptDebtPayload(
      vaultKey,
      userId,
      row.id,
      payload,
    );

    const { error: updateError } = await debtsTable
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

export async function migrateLegacyPlaintextDebtPayments(
  supabase: SupabaseClient,
  vaultKey: CryptoKey,
  userId: string,
): Promise<number> {
  const paymentsTable = supabase.from("debt_payments") as any;

  const { data, error } = await paymentsTable
    .select(
      "id,user_id,amount,currency,amount_eur,exchange_rate_to_eur,notes,encrypted_payload,encryption_version",
    )
    .eq("user_id", userId);

  if (error) throw error;

  let migrated = 0;

  for (const row of (data ?? []) as LegacyDebtPaymentRow[]) {
    if (row.user_id !== userId) continue;
    if (row.encryption_version === 1 && row.encrypted_payload) continue;

    try {
      const payload: DebtPaymentPrivatePayloadV1 = {
        amount: Number(row.amount),
        currency: row.currency,
        amount_eur: Number(row.amount_eur),
        exchange_rate_to_eur: Number(row.exchange_rate_to_eur),
        notes: row.notes,
      };

      const encryptedPayload = await encryptDebtPaymentPayload(
        vaultKey,
        userId,
        row.id,
        payload,
      );

      const { error: updateError } = await paymentsTable
        .update({
          encrypted_payload: encryptedPayload,
          encryption_version: 1,
        })
        .eq("id", row.id)
        .eq("user_id", userId);

      if (updateError) throw updateError;
      migrated += 1;
    } catch (paymentError) {
      console.error("Legacy Debt payment E2EE migration failed", {
        paymentId: row.id,
        error: paymentError,
      });
    }
  }

  return migrated;
}

export async function migrateLegacyPlaintextDebtData(
  supabase: SupabaseClient,
  vaultKey: CryptoKey,
  userId: string,
): Promise<{ debts: number; payments: number }> {
  const debts = await migrateLegacyPlaintextDebts(
    supabase,
    vaultKey,
    userId,
  );
  const payments = await migrateLegacyPlaintextDebtPayments(
    supabase,
    vaultKey,
    userId,
  );

  return { debts, payments };
}
