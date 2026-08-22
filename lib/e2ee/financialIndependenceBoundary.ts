import type { FinancialIndependenceClientPayload } from "@/lib/e2ee/financialIndependenceClientInputs";

type BoundaryState = {
  getPayload: () => FinancialIndependenceClientPayload;
};

export function installFinancialIndependenceE2eeBoundary(
  client: any,
  getPayload: () => FinancialIndependenceClientPayload,
) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterFinancialIndependenceBoundaryState as BoundaryState | undefined;
  if (existing) {
    existing.getPayload = getPayload;
    return;
  }

  const state: BoundaryState = { getPayload };
  rawClient.__ficonterFinancialIndependenceBoundaryState = state;
  const originalRpc = rawClient.rpc.bind(rawClient);

  rawClient.rpc = (
    fn: string,
    args?: Record<string, unknown>,
    options?: unknown,
  ) => {
    if (fn === "get_financial_independence_inputs") {
      return Promise.resolve({ data: state.getPayload(), error: null });
    }
    return originalRpc(fn, args, options);
  };
}
