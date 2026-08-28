import type { EmergencyFundInputs } from "@/lib/wealth/emergencyFund";

type EmergencyBoundaryState = {
  getInputs: () => EmergencyFundInputs;
};

export function installEmergencyFundIntelligenceE2eeBoundary(
  client: any,
  getInputs: () => EmergencyFundInputs,
) {
  const rawClient = client as any;
  const existing = rawClient.__ficonterEmergencyFundBoundaryState as
    | EmergencyBoundaryState
    | undefined;

  if (existing) {
    existing.getInputs = getInputs;
    return;
  }

  const state: EmergencyBoundaryState = { getInputs };
  rawClient.__ficonterEmergencyFundBoundaryState = state;
  const originalRpc = rawClient.rpc.bind(rawClient);

  rawClient.rpc = (
    fn: string,
    args?: Record<string, unknown>,
    options?: unknown,
  ) => {
    if (fn === "get_emergency_fund_intelligence_inputs") {
      return Promise.resolve({ data: state.getInputs(), error: null });
    }
    return originalRpc(fn, args, options);
  };
}
