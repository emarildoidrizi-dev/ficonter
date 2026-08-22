import { decryptDebtPayload, encryptDebtPayload } from "@/lib/e2ee/debtPayload";
import { encryptDebtPaymentPayload } from "@/lib/e2ee/debtPaymentPayload";
import { encryptTransactionPayload } from "@/lib/e2ee/transactionPayload";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function finalizePendingEncryptedDebtPayments(
  supabase: any,
  vaultKey: CryptoKey,
  userId: string,
): Promise<number> {
  const { data: runs, error: runsError } = await supabase
    .from("automatic_payment_runs")
    .select("id,source_id,occurrence_key,scheduled_for,status")
    .eq("user_id", userId)
    .eq("source_type", "debt")
    .eq("trigger_mode", "automatic")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true });

  if (runsError) throw runsError;

  let completed = 0;

  for (const run of runs ?? []) {
    const { data: debtRow, error: debtError } = await (supabase.from("debts") as any)
      .select("id,user_id,encrypted_payload,encryption_version,e2ee_revision,status,debt_kind")
      .eq("id", run.source_id)
      .eq("user_id", userId)
      .single();

    if (debtError || !debtRow) continue;
    if (
      debtRow.debt_kind !== "standard" ||
      debtRow.encryption_version !== 1 ||
      !debtRow.encrypted_payload ||
      debtRow.status !== "active"
    ) {
      continue;
    }

    const debt = await decryptDebtPayload(vaultKey, userId, debtRow);
    const amount = roundMoney(
      Math.min(debt.current_balance, debt.minimum_payment),
    );

    if (amount <= 0) continue;

    const amountEur = roundMoney(
      Math.min(
        debt.current_balance_eur,
        amount * debt.exchange_rate_to_eur,
      ),
    );

    if (amountEur <= 0) continue;

    const updatedDebt = {
      ...debt,
      current_balance: roundMoney(
        Math.max(0, debt.current_balance - amount),
      ),
      current_balance_eur: roundMoney(
        Math.max(0, debt.current_balance_eur - amountEur),
      ),
    };

    const newStatus =
      updatedDebt.current_balance === 0 ? "paid_off" : "active";
    const paymentId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();
    const paidAt = String(run.scheduled_for);
    const transactionDate = paidAt.slice(0, 10);

    const [newDebtPayload, paymentPayload, transactionPayload] =
      await Promise.all([
        encryptDebtPayload(
          vaultKey,
          userId,
          debtRow.id,
          updatedDebt,
        ),
        encryptDebtPaymentPayload(
          vaultKey,
          userId,
          paymentId,
          {
            amount,
            currency: debt.currency,
            amount_eur: amountEur,
            exchange_rate_to_eur: debt.exchange_rate_to_eur,
            notes: "Automatic monthly debt payment",
          },
        ),
        encryptTransactionPayload(vaultKey, userId, {
          description: `Debt payment · ${debt.name}`,
          amount,
          currency: debt.currency,
          amount_eur: amountEur,
          exchange_rate_to_eur: debt.exchange_rate_to_eur,
          exchange_rate_date: transactionDate,
          exchange_rate_source: "Automatic Debt schedule",
          type: "expense",
          category: "Debt repayment",
          transaction_date: transactionDate,
          occurred_at: paidAt,
        }),
      ]);

    const { error: finalizeError } = await (supabase as any).rpc(
      "record_automatic_debt_payment_e2ee_atomic",
      {
        p_run_id: run.id,
        p_expected_revision: Number(debtRow.e2ee_revision ?? 0),
        p_new_debt_payload: newDebtPayload,
        p_new_status: newStatus,
        p_payment_id: paymentId,
        p_payment_payload: paymentPayload,
        p_transaction_id: transactionId,
        p_transaction_payload: transactionPayload,
      },
    );

    if (!finalizeError) completed += 1;
  }

  return completed;
}
