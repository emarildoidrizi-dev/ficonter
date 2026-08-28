import { encryptCreditCardPayload } from "@/lib/e2ee/creditCardPayload";
import { encryptCreditCardActivityPayload } from "@/lib/e2ee/creditCardActivityPayload";
import { encryptCreditCardMonthlyRecordPayload } from "@/lib/e2ee/creditCardMonthlyRecordPayload";
import { encryptDebtPaymentPayload } from "@/lib/e2ee/debtPaymentPayload";

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function migrateLegacyPlaintextCreditCardData(
  supabase: any,
  vaultKey: CryptoKey,
  userId: string,
) {
  const cardsResult = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", userId)
    .eq("debt_kind", "credit_card");
  if (cardsResult.error) throw cardsResult.error;

  const cards = (cardsResult.data ?? []) as any[];
  const cardIds = cards.map((card) => card.id);

  for (const card of cards) {
    if (card.encryption_version === 1 && card.encrypted_payload) continue;
    const encrypted = await encryptCreditCardPayload(vaultKey, userId, card.id, {
      name: String(card.name ?? "Credit card"),
      lender: typeof card.lender === "string" ? card.lender : null,
      description: typeof card.description === "string" ? card.description : null,
      card_last_four: typeof card.card_last_four === "string" ? card.card_last_four : null,
      currency: String(card.currency ?? "EUR"),
      original_balance: num(card.original_balance),
      current_balance: num(card.current_balance),
      original_balance_eur: num(card.original_balance_eur),
      current_balance_eur: num(card.current_balance_eur),
      exchange_rate_to_eur: num(card.exchange_rate_to_eur, 1),
      annual_interest_rate: num(card.annual_interest_rate),
      credit_limit: num(card.credit_limit),
      credit_limit_eur: num(card.credit_limit_eur),
      statement_balance: card.statement_balance == null ? null : num(card.statement_balance),
      statement_balance_eur: card.statement_balance_eur == null ? null : num(card.statement_balance_eur),
      minimum_payment: num(card.minimum_payment),
      minimum_payment_eur: num(card.minimum_payment_eur),
      statement_date: card.statement_date ?? null,
      payment_due_date: card.payment_due_date ?? null,
      interest_charged: num(card.interest_charged),
      interest_charged_eur: num(card.interest_charged_eur),
    });

    const { error } = await supabase
      .from("debts")
      .update({
        encrypted_payload: encrypted,
        encryption_version: 1,
        e2ee_revision: num(card.e2ee_revision) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", card.id)
      .eq("user_id", userId)
      .eq("e2ee_revision", num(card.e2ee_revision));
    if (error) throw error;
  }

  if (!cardIds.length) return;

  const [activitiesResult, monthlyResult, paymentsResult] = await Promise.all([
    supabase.from("credit_card_activities").select("*").eq("user_id", userId).in("debt_id", cardIds),
    supabase.from("credit_card_monthly_records").select("*").eq("user_id", userId).in("debt_id", cardIds),
    supabase.from("debt_payments").select("*").eq("user_id", userId).in("debt_id", cardIds),
  ]);
  if (activitiesResult.error) throw activitiesResult.error;
  if (monthlyResult.error) throw monthlyResult.error;
  if (paymentsResult.error) throw paymentsResult.error;

  for (const row of activitiesResult.data ?? []) {
    if (row.encryption_version === 1 && row.encrypted_payload) continue;
    const encrypted = await encryptCreditCardActivityPayload(vaultKey, userId, row.id, {
      activity_type: row.activity_type,
      description: String(row.description ?? "Card activity"),
      amount: num(row.amount),
      currency: String(row.currency ?? "EUR"),
      amount_eur: num(row.amount_eur),
      exchange_rate_to_eur: num(row.exchange_rate_to_eur, 1),
      balance_effect: num(row.balance_effect),
      balance_effect_eur: num(row.balance_effect_eur),
      notes: typeof row.notes === "string" ? row.notes : null,
    });
    const { error } = await supabase.from("credit_card_activities").update({
      encrypted_payload: encrypted,
      encryption_version: 1,
      e2ee_revision: num(row.e2ee_revision) + 1,
    }).eq("id", row.id).eq("user_id", userId).eq("e2ee_revision", num(row.e2ee_revision));
    if (error) throw error;
  }

  for (const row of monthlyResult.data ?? []) {
    if (row.encryption_version === 1 && row.encrypted_payload) continue;
    const encrypted = await encryptCreditCardMonthlyRecordPayload(vaultKey, userId, row.id, {
      currency: String(row.currency ?? "EUR"),
      statement_balance: num(row.statement_balance),
      statement_balance_eur: num(row.statement_balance_eur),
      minimum_payment: num(row.minimum_payment),
      minimum_payment_eur: num(row.minimum_payment_eur),
      interest_charged: num(row.interest_charged),
      interest_charged_eur: num(row.interest_charged_eur),
      statement_date: String(row.statement_date),
      payment_due_date: String(row.payment_due_date),
    });
    const { error } = await supabase.from("credit_card_monthly_records").update({
      encrypted_payload: encrypted,
      encryption_version: 1,
      e2ee_revision: num(row.e2ee_revision) + 1,
    }).eq("id", row.id).eq("user_id", userId).eq("e2ee_revision", num(row.e2ee_revision));
    if (error) throw error;
  }

  for (const row of paymentsResult.data ?? []) {
    if (row.encryption_version === 1 && row.encrypted_payload) continue;
    const encrypted = await encryptDebtPaymentPayload(vaultKey, userId, row.id, {
      amount: num(row.amount),
      currency: String(row.currency ?? "EUR"),
      amount_eur: num(row.amount_eur),
      exchange_rate_to_eur: num(row.exchange_rate_to_eur, 1),
      notes: typeof row.notes === "string" ? row.notes : null,
    });
    const { error } = await supabase.from("debt_payments").update({
      encrypted_payload: encrypted,
      encryption_version: 1,
    }).eq("id", row.id).eq("user_id", userId);
    if (error) throw error;
  }
}
