import type { SavingsIntelligenceInputs } from "@/lib/wealth/savingsIntelligence";

type BoundaryState = {
  getInputs: () => SavingsIntelligenceInputs;
};

export function installSavingsIntelligenceE2eeBoundary(
  client: any,
  getInputs: () => SavingsIntelligenceInputs,
) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterSavingsIntelligenceBoundaryState as BoundaryState | undefined;
  if (existing) {
    existing.getInputs = getInputs;
    return;
  }

  const state: BoundaryState = { getInputs };
  rawClient.__ficonterSavingsIntelligenceBoundaryState = state;
  const originalRpc = rawClient.rpc.bind(rawClient);

  rawClient.rpc = (fn: string, args?: Record<string, unknown>, options?: unknown) => {
    if (fn === "get_savings_intelligence_inputs") {
      return Promise.resolve({ data: state.getInputs(), error: null });
    }
    return originalRpc(fn, args, options);
  };
}
