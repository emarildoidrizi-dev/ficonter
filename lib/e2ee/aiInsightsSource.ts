import type { CurrencySourceData } from "@/lib/finance/baseCurrencyReconciliation";
import { buildAiInsightsClientInputs } from "@/lib/e2ee/aiInsightsClientInputs";
import { loadFinancialIndependenceSettingsFromVault } from "@/lib/e2ee/financialIndependenceSettingsSource";
import type { AiInsightPreferences, AiInsightsInputs } from "@/lib/wealth/aiInsights";

const EMPTY_PREFERENCES: AiInsightPreferences = {
  enabled: false,
  consentVersion: null,
  consentedAt: null,
  updatedAt: null,
};

export async function loadAiInsightsInputsFromVault(
  client: any,
  vaultKey: CryptoKey,
  userId: string,
  source: CurrencySourceData,
): Promise<AiInsightsInputs> {
  const [settings, preferenceResult] = await Promise.all([
    loadFinancialIndependenceSettingsFromVault(client, vaultKey, userId),
    client
      .from("ai_insight_preferences")
      .select("enabled,consent_version,consented_at,updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (preferenceResult.error) throw preferenceResult.error;
  const row = preferenceResult.data;
  const preferences: AiInsightPreferences = row
    ? {
        enabled: row.enabled === true,
        consentVersion: row.consent_version ?? null,
        consentedAt: row.consented_at ?? null,
        updatedAt: row.updated_at ?? null,
      }
    : EMPTY_PREFERENCES;

  return buildAiInsightsClientInputs(source, settings, preferences);
}
