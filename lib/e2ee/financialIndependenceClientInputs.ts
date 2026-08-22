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
