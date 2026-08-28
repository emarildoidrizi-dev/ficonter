import type { CurrencySourceData } from "@/lib/finance/baseCurrencyReconciliation";
import { buildNetWorthGrowthInputsFromSource } from "@/lib/wealth/netWorthClientInputs";

type State = { getSource: () => CurrencySourceData };

export function installFinancialHealthE2eeBoundary(
  client: any,
  getSource: () => CurrencySourceData,
) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterFinancialHealthBoundaryState as State | undefined;
  if (existing) {
    existing.getSource = getSource;
    return;
  }

  const state: State = { getSource };
  rawClient.__ficonterFinancialHealthBoundaryState = state;
  const originalRpc = rawClient.rpc.bind(rawClient);

  rawClient.rpc = (
    fn: string,
    args?: Record<string, unknown>,
    options?: unknown,
  ) => {
    if (fn === "get_financial_health_inputs") {
      const growth = buildNetWorthGrowthInputsFromSource(state.getSource());
      return Promise.resolve({
        data: growth.wealthScore.financialHealth,
        error: null,
      });
    }
    return originalRpc(fn, args, options);
  };
}
