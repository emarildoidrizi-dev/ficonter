import type { CurrencySourceData } from "@/lib/finance/baseCurrencyReconciliation";
import { loadAiInsightsInputsFromVault } from "@/lib/e2ee/aiInsightsSource";

type BoundaryState = {
  vaultKey: CryptoKey;
  userId: string;
  getSource: () => CurrencySourceData;
};

export function installAiInsightsE2eeBoundary(
  client: any,
  vaultKey: CryptoKey,
  userId: string,
  getSource: () => CurrencySourceData,
) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterAiInsightsBoundaryState as BoundaryState | undefined;
  if (existing) {
    existing.vaultKey = vaultKey;
    existing.userId = userId;
    existing.getSource = getSource;
    return;
  }

  const state: BoundaryState = { vaultKey, userId, getSource };
  rawClient.__ficonterAiInsightsBoundaryState = state;
  const originalRpc = rawClient.rpc.bind(rawClient);

  rawClient.rpc = (
    fn: string,
    args?: Record<string, unknown>,
    options?: unknown,
  ) => {
    if (fn === "get_ai_insights_inputs") {
      return loadAiInsightsInputsFromVault(
        rawClient,
        state.vaultKey,
        state.userId,
        state.getSource(),
      )
        .then((data) => ({ data, error: null }))
        .catch((error) => ({ data: null, error }));
    }
    return originalRpc(fn, args, options);
  };
}
