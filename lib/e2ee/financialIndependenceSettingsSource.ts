import type { FinancialIndependenceClientPayload } from "@/lib/e2ee/financialIndependenceClientInputs";
import { decryptFinancialIndependenceSettingsPayload } from "@/lib/e2ee/financialIndependenceSettingsPayload";

export async function loadFinancialIndependenceSettingsFromVault(
  client: any,
  vaultKey: CryptoKey,
  userId: string,
): Promise<FinancialIndependenceClientPayload["settings"]> {
  const result = await client
    .from("financial_independence_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (result.error) throw result.error;
  if (!result.data) return undefined;

  const row = result.data;
  if (row.encryption_version === 1 && row.encrypted_payload) {
    const opened = await decryptFinancialIndependenceSettingsPayload(
      vaultKey,
      userId,
      row,
    );
    return {
      targetMonthlySpending: opened.target_monthly_spending,
      withdrawalRate: opened.withdrawal_rate,
      annualRealReturnRate: opened.annual_real_return_rate,
      updatedAt: row.updated_at ?? null,
    };
  }

  return {
    targetMonthlySpending: row.target_monthly_spending,
    withdrawalRate: row.withdrawal_rate,
    annualRealReturnRate: row.annual_real_return_rate,
    updatedAt: row.updated_at ?? null,
  };
}
