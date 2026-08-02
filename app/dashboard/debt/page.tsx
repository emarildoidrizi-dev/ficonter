import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { DebtManager } from "@/components/DebtManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DebtPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const [{ data: debts, error: debtError }, { data: payments, error: paymentError }] =
    await Promise.all([
      supabase
        .from("debts")
        .select("id,user_id,name,lender,description,category,original_balance,current_balance,currency,original_balance_eur,current_balance_eur,exchange_rate_to_eur,annual_interest_rate,minimum_payment,minimum_payment_eur,payment_due_day,autopay,autopay_record_time,autopay_timezone,autopay_enabled_at,start_date,maturity_date,status,created_at,updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("debt_payments")
        .select("id,debt_id,user_id,amount,currency,amount_eur,exchange_rate_to_eur,paid_at,notes,transaction_id,created_at")
        .eq("user_id", user.id)
        .order("paid_at", { ascending: false }),
    ]);

  return (
    <DebtManager
      userId={user.id}
      initialDebts={debts ?? []}
      initialPayments={payments ?? []}
      initialError={debtError?.message ?? paymentError?.message ?? ""}
    />
  );
}
