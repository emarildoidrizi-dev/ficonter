import { loadBusinessProfitabilityReport } from "@/lib/e2ee/businessProfitabilitySource";

type State = { businessId: string };

export function installBusinessReportingBoundary(client: any, businessId: string) {
  const raw = client as any;
  const existing = raw.__ficonterBusinessReportingBoundary as State | undefined;
  if (existing) {
    existing.businessId = businessId;
    return;
  }
  const state: State = { businessId };
  raw.__ficonterBusinessReportingBoundary = state;
  const originalRpc = raw.rpc.bind(raw);
  raw.rpc = (fn: string, args?: Record<string, unknown>, options?: unknown) => {
    if (fn !== "get_business_profitability_report") return originalRpc(fn, args, options);
    return (async () => {
      try {
        const requestedBusinessId = String(args?.p_business_id ?? state.businessId);
        if (requestedBusinessId !== state.businessId) throw new Error("The requested report is not for the active business.");
        const data = await loadBusinessProfitabilityReport(
          raw,
          state.businessId,
          String(args?.p_start_date ?? ""),
          String(args?.p_end_date ?? ""),
        );
        return { data, error: null };
      } catch (caught) {
        return { data: null, error: caught instanceof Error ? caught : new Error("Business report could not be built.") };
      }
    })();
  };
}
