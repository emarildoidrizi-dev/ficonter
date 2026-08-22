import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { EncryptedCashFlowWorkspace } from "@/components/EncryptedCashFlowWorkspace";
import { reconcileCashFlowMonthlyInputs } from "@/lib/finance/monthlyCashActuals";
import {
  normalizeCashFlowDebtPayments,
  normalizeCashFlowIntelligenceInputs,
} from "@/lib/wealth/cashFlowIntelligence";

import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function currentMonthStartIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  ).toISOString();
}

export default async function CashFlowPage() {
  await requireSubscriptionFeature("cash_flow_intelligence");
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const [inputResponse, paymentResponse, billResponse] = await Promise.all([
    supabase.rpc("get_cash_flow_intelligence_inputs_v2"),
    supabase
      .from("debt_payments")
      .select("debt_id, amount_eur, paid_at")
      .eq("user_id", user.id)
      .gte("paid_at", currentMonthStartIso()),
    supabase
      .from("bills")
      .select("id,status,amount_eur,due_date,paid_at,transaction_id")
      .eq("user_id", user.id),
  ]);

  const normalizedInputs = normalizeCashFlowIntelligenceInputs(inputResponse.data);
  const synchronizedInputs = reconcileCashFlowMonthlyInputs(
    normalizedInputs,
    [],
    billResponse.data,
  );

  return (
    <EncryptedCashFlowWorkspace
      userId={user.id}
      initialInputs={synchronizedInputs}
      initialDebtPayments={normalizeCashFlowDebtPayments(paymentResponse.data)}
      initialError={
        inputResponse.error?.message ??
        paymentResponse.error?.message ??
        billResponse.error?.message ??
        ""
      }
    />
  );
}
