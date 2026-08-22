import type { CurrencySourceData } from "@/lib/finance/baseCurrencyReconciliation";
import { buildEmergencyFundClientInputs } from "@/lib/e2ee/emergencyFundClientInputs";
import { buildSavingsClientInputs } from "@/lib/e2ee/savingsClientInputs";
import { buildNetWorthGrowthInputsFromSource } from "@/lib/wealth/netWorthClientInputs";

export type FinancialIndependenceClientPayload = {
  settings?: {
    targetMonthlySpending?: number | string | null;
    withdrawalRate?: number | string | null;
    annualRealReturnRate?: number | string | null;
    updatedAt?: string | null;
  };
  netWorthGrowth?: Record<string, unknown>;
  savingsIntelligence?: Record<string, unknown>;
  emergencyFund?: Record<string, unknown>;
};

export function buildFinancialIndependenceClientInputs(
  source: CurrencySourceData,
  settings?: FinancialIndependenceClientPayload["settings"],
): FinancialIndependenceClientPayload {
  return {
    settings,
    netWorthGrowth: buildNetWorthGrowthInputsFromSource(source) as unknown as Record<string, unknown>,
    savingsIntelligence: buildSavingsClientInputs(source) as unknown as Record<string, unknown>,
    emergencyFund: buildEmergencyFundClientInputs(source) as unknown as Record<string, unknown>,
  };
}
