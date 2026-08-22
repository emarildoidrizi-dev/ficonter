import type { CurrencySourceData } from "@/lib/finance/baseCurrencyReconciliation";
import { buildCashFlowClientInputs } from "@/lib/e2ee/cashFlowClientInputs";
import {
  buildFinancialIndependenceClientInputs,
  type FinancialIndependenceClientPayload,
} from "@/lib/e2ee/financialIndependenceClientInputs";
import {
  normalizeAiInsightsInputs,
  type AiInsightPreferences,
  type AiInsightsInputs,
} from "@/lib/wealth/aiInsights";

export function buildAiInsightsClientInputs(
  source: CurrencySourceData,
  settings: FinancialIndependenceClientPayload["settings"],
  preferences: AiInsightPreferences,
): AiInsightsInputs {
  return normalizeAiInsightsInputs({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    cashFlow: buildCashFlowClientInputs(source),
    financialIndependence: buildFinancialIndependenceClientInputs(
      source,
      settings,
    ),
    preferences,
  });
}
