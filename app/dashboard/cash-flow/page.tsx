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

  return (
    <CashFlowIntelligence
      userId={user.id}
      initialInputs={normalizeCashFlowIntelligenceInputs(inputResponse.data)}
      initialDebtPayments={normalizeCashFlowDebtPayments(paymentResponse.data)}
      initialError={
        inputResponse.error?.message ?? paymentResponse.error?.message ?? ""
      }
    />
  );
}
