import { encryptMonthlyPlanPayload } from "@/lib/e2ee/monthlyPlanPayload";
import { encryptMonthlyPlanItemPayload } from "@/lib/e2ee/monthlyPlanItemPayload";

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function migrateLegacyPlaintextMonthlyPlanner(
  supabase: any,
  vaultKey: CryptoKey,
  userId: string,
) {
  const [plansResult, itemsResult] = await Promise.all([
    supabase.from("monthly_budget_plans").select("*").eq("user_id", userId),
    supabase.from("monthly_budget_items").select("*").eq("user_id", userId),
  ]);
  if (plansResult.error) throw plansResult.error;
  if (itemsResult.error) throw itemsResult.error;

  for (const row of plansResult.data ?? []) {
    if (row.encryption_version === 1 && row.encrypted_payload) continue;
    const cipher = await encryptMonthlyPlanPayload(vaultKey, userId, row.id, {
      start_balance: num(row.start_balance),
      spending_budget: num(row.spending_budget),
    });
    const revision = num(row.e2ee_revision);
    const { error } = await supabase.from("monthly_budget_plans").update({
      encrypted_payload: cipher,
      encryption_version: 1,
      e2ee_revision: revision + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id).eq("user_id", userId).eq("e2ee_revision", revision);
    if (error) throw error;
  }

  for (const row of itemsResult.data ?? []) {
    if (row.encryption_version === 1 && row.encrypted_payload) continue;
    const cipher = await encryptMonthlyPlanItemPayload(vaultKey, userId, row.id, {
      section: row.section,
      label: String(row.label ?? "Planner item"),
      planned_amount: num(row.planned_amount),
    });
    const revision = num(row.e2ee_revision);
    const { error } = await supabase.from("monthly_budget_items").update({
      encrypted_payload: cipher,
      encryption_version: 1,
      e2ee_revision: revision + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id).eq("user_id", userId).eq("e2ee_revision", revision);
    if (error) throw error;
  }
}
