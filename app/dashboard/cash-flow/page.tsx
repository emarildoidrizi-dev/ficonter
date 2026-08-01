import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { CashFlowIntelligence } from "@/components/CashFlowIntelligence";
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

  const initialInputs = normalizeCashFlowIntelligenceInputs(inputResponse.data);
  const activeMonth =
    initialInputs.monthly.at(-1)?.month ||
    initialInputs.generatedAt.slice(0, 7) ||
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
      initialInputs={initialInputs}
      initialDebtPayments={normalizeCashFlowDebtPayments(paymentResponse.data)}
      initialOpeningBalance={Number(planResponse.data?.start_balance ?? 0)}
      initialError={
        inputResponse.error?.message ??
        paymentResponse.error?.message ??
        planResponse.error?.message ??
        ""
      }
    />
  );
}
