import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { DashboardLiveOverview } from "@/components/DashboardLiveOverview";
import {
  reconcileAiInsightsInputs,
  reconcileFinancialHealthInputs,
} from "@/lib/finance/monthlyCashActuals";
import { normalizeFinancialHealthInputs } from "@/lib/wealth/financialHealth";
import { normalizeAiInsightsInputs } from "@/lib/wealth/aiInsights";
import { readSetupAcknowledgements } from "@/lib/wealth/setupReadiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const [
    transactionResult,
    billResult,
    healthResult,
    gpsResult,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id,user_id,description,amount,currency,amount_eur,exchange_rate_to_eur,exchange_rate_date,type,category,transaction_date,occurred_at,created_at",
      )
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("bills")
      .select("id,status,amount_eur,due_date,paid_at,transaction_id")
      .eq("user_id", user.id),
    supabase.rpc("get_financial_health_inputs"),
    supabase.rpc("get_ai_insights_inputs"),
  ]);

  const transactions = transactionResult.data ?? [];
  const bills = billResult.data ?? [];
  const healthInputs = reconcileFinancialHealthInputs(
    normalizeFinancialHealthInputs(healthResult.data),
    transactions,
    bills,
  );
  const gpsInputs = reconcileAiInsightsInputs(
    normalizeAiInsightsInputs(gpsResult.data),
    transactions,
    bills,
  );
  const name =
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    "there";

  return (
    <DashboardLiveOverview
      userId={user.id}
      name={name}
      initialTransactions={transactions}
      initialBills={bills}
      initialHealthInputs={healthInputs}
      initialSetupAcknowledgements={readSetupAcknowledgements(
        user.user_metadata,
      )}
      initialGpsInputs={gpsInputs}
      initialError={
        transactionResult.error?.message ?? billResult.error?.message ?? ""
      }
      initialHealthError={healthResult.error?.message ?? ""}
      initialGpsError={gpsResult.error?.message ?? ""}
    />
  );
}
