import { encryptGoalPayload } from "@/lib/e2ee/goalPayload";
import { encryptGoalInvestmentPayload } from "@/lib/e2ee/goalInvestmentPayload";

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function migrateLegacyPlaintextGoals(
  supabase: any,
  vaultKey: CryptoKey,
  userId: string,
) {
  const goalsResult = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (goalsResult.error) throw goalsResult.error;

  const goals = (goalsResult.data ?? []) as any[];
  for (const goal of goals) {
    if (goal.encryption_version === 1 && goal.encrypted_payload) continue;

    const encrypted = await encryptGoalPayload(vaultKey, userId, goal.id, {
      name: String(goal.name ?? "Goal"),
      target_amount: num(goal.target_amount),
      current_amount: num(goal.current_amount),
      target_date: typeof goal.target_date === "string" ? goal.target_date : null,
      status: goal.status === "completed" || goal.status === "paused" ? goal.status : "active",
    });

    const revision = num(goal.e2ee_revision);
    const { error } = await supabase
      .from("goals")
      .update({
        encrypted_payload: encrypted,
        encryption_version: 1,
        e2ee_revision: revision + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goal.id)
      .eq("user_id", userId)
      .eq("e2ee_revision", revision);
    if (error) throw error;
  }

  const investmentsResult = await supabase
    .from("goal_investments")
    .select("*")
    .eq("user_id", userId)
    .order("invested_at", { ascending: false });
  if (investmentsResult.error) throw investmentsResult.error;

  for (const row of investmentsResult.data ?? []) {
    if (row.encryption_version === 1 && row.encrypted_payload) continue;
    const amountEur = num(row.amount);
    const originalAmount = row.original_amount == null ? amountEur : num(row.original_amount);
    const currency = typeof row.currency === "string" && row.currency.trim()
      ? row.currency.trim().toUpperCase()
      : "EUR";
    const exchangeRate = row.exchange_rate_to_eur == null ? 1 : num(row.exchange_rate_to_eur, 1);

    const encrypted = await encryptGoalInvestmentPayload(vaultKey, userId, row.id, {
      amount: amountEur,
      original_amount: originalAmount,
      currency,
      exchange_rate_to_eur: exchangeRate,
      exchange_rate_date: typeof row.exchange_rate_date === "string" ? row.exchange_rate_date : null,
      notes: typeof row.notes === "string" ? row.notes : null,
    });

    const revision = num(row.e2ee_revision);
    const { error } = await supabase
      .from("goal_investments")
      .update({
        encrypted_payload: encrypted,
        encryption_version: 1,
        e2ee_revision: revision + 1,
      })
      .eq("id", row.id)
      .eq("user_id", userId)
      .eq("e2ee_revision", revision);
    if (error) throw error;
  }
}
