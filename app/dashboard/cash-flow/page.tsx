import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { CashFlowIntelligence } from "@/components/CashFlowIntelligence";
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

  const [
    inputResponse,
    paymentResponse,
    transactionResponse,
    billResponse,
  ] = await Promise.all([
    supabase.rpc("get_cash_flow_intelligence_inputs_v2"),
    supabase
      .from("debt_payments")
      .select("debt_id, amount_eur, paid_at")
      .gte("paid_at", currentMonthStartIso()),
    supabase
      .from("transactions")
      .select(
        "id,type,description,category,amount_eur,transaction_date,occurred_at",
      )
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: true }),
    supabase
      .from("bills")
      .select("id,status,amount_eur,due_date,paid_at,transaction_id")
      .eq("user_id", user.id),
  ]);

  const normalizedInputs = normalizeCashFlowIntelligenceInputs(
    inputResponse.data,
  );
  const synchronizedInputs = reconcileCashFlowMonthlyInputs(
    normalizedInputs,
    transactionResponse.data,
    billResponse.data,
  );
  const activeMonth =
    synchronizedInputs.monthly.at(-1)?.month ||
    synchronizedInputs.generatedAt.slice(0, 7) ||
    new Date().toISOString().slice(0, 7);

  const planResponse = await supabase
    .from("monthly_budget_plans")
    .select("start_balance")
    .eq("user_id", user.id)
    .eq("month", activeMonth)
    .maybeSingle();

  return (
    <CashFlowIntelligence
      userId={user.id}
      initialInputs={synchronizedInputs}
      initialDebtPayments={normalizeCashFlowDebtPayments(paymentResponse.data)}
      initialOpeningBalance={Number(planResponse.data?.start_balance ?? 0)}
      initialError={
        inputResponse.error?.message ??
        paymentResponse.error?.message ??
        transactionResponse.error?.message ??
        billResponse.error?.message ??
        planResponse.error?.message ??
        ""
      }
    />
  );
}
