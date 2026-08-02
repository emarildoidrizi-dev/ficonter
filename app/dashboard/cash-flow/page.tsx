import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { CashFlowIntelligence } from "@/components/CashFlowIntelligence";
import {
  cashFlowHistoryBounds,
  reconcileCashFlowMonthlyInputs,
} from "@/lib/finance/monthlyCashActuals";
import {
  normalizeCashFlowDebtPayments,
  normalizeCashFlowIntelligenceInputs,
} from "@/lib/wealth/cashFlowIntelligence";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function currentMonthStartIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  ).toISOString();
}

export default async function CashFlowPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const [inputResponse, paymentResponse] = await Promise.all([
    supabase.rpc("get_cash_flow_intelligence_inputs_v2"),
    supabase
      .from("debt_payments")
      .select("debt_id, amount_eur, paid_at")
      .gte("paid_at", currentMonthStartIso()),
  ]);

  const normalizedInputs = normalizeCashFlowIntelligenceInputs(
    inputResponse.data,
  );
  const activeMonth =
    normalizedInputs.monthly.at(-1)?.month ||
    normalizedInputs.generatedAt.slice(0, 7) ||
    new Date().toISOString().slice(0, 7);
  const historyBounds = cashFlowHistoryBounds(normalizedInputs);

  const [planResponse, transactionResponse, billResponse] = await Promise.all([
    supabase
      .from("monthly_budget_plans")
      .select("start_balance")
      .eq("user_id", user.id)
      .eq("month", activeMonth)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("id, type, amount_eur, transaction_date, occurred_at")
      .eq("user_id", user.id)
      .gte("transaction_date", historyBounds.start)
      .lt("transaction_date", historyBounds.endExclusive),
    supabase
      .from("bills")
      .select("id, status, amount_eur, due_date, paid_at, transaction_id")
      .eq("user_id", user.id),
  ]);

  const synchronizedInputs = reconcileCashFlowMonthlyInputs(
    normalizedInputs,
    transactionResponse.data,
    billResponse.data,
  );

  return (
    <CashFlowIntelligence
      userId={user.id}
      initialInputs={synchronizedInputs}
      initialDebtPayments={normalizeCashFlowDebtPayments(paymentResponse.data)}
      initialOpeningBalance={Number(planResponse.data?.start_balance ?? 0)}
      initialError={
        inputResponse.error?.message ??
        paymentResponse.error?.message ??
        planResponse.error?.message ??
        transactionResponse.error?.message ??
        billResponse.error?.message ??
        ""
      }
    />
  );
}
