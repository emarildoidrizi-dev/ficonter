import { redirect } from "next/navigation";
import { CreditCardsManager } from "@/components/CreditCardsManager";
import { getCurrentUser } from "@/lib/auth/currentUser";

import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CreditCardsPage() {
  await requireSubscriptionFeature("credit_cards");
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const [
    cardsResult,
    activitiesResult,
    paymentsResult,
    monthlyRecordsResult,
  ] = await Promise.all([
    supabase
      .from("debts")
      .select(
        "id,user_id,name,lender,description,category,original_balance,current_balance,currency,original_balance_eur,current_balance_eur,exchange_rate_to_eur,annual_interest_rate,minimum_payment,minimum_payment_eur,payment_due_day,start_date,status,card_last_four,credit_limit,credit_limit_eur,statement_balance,statement_balance_eur,statement_date,payment_due_date,interest_charged,interest_charged_eur,created_at,updated_at",
      )
      .eq("user_id", user.id)
      .ilike("category", "credit card")
      .order("current_balance_eur", { ascending: false }),
    supabase
      .from("credit_card_activities")
      .select(
        "id,debt_id,user_id,activity_type,description,amount,currency,amount_eur,exchange_rate_to_eur,balance_effect,balance_effect_eur,occurred_at,notes,created_at",
      )
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("debt_payments")
      .select(
        "id,debt_id,user_id,amount,currency,amount_eur,exchange_rate_to_eur,paid_at,notes,transaction_id,created_at",
      )
      .eq("user_id", user.id)
      .order("paid_at", { ascending: false }),
    supabase
      .from("credit_card_monthly_records")
      .select(
        "id,debt_id,user_id,month_start,currency,statement_balance,statement_balance_eur,minimum_payment,minimum_payment_eur,interest_charged,interest_charged_eur,statement_date,payment_due_date,created_at,updated_at",
      )
      .eq("user_id", user.id)
      .order("month_start", { ascending: false }),
  ]);

  return (
    <CreditCardsManager
      userId={user.id}
      initialCards={cardsResult.data ?? []}
      initialActivities={activitiesResult.data ?? []}
      initialPayments={paymentsResult.data ?? []}
      initialMonthlyRecords={monthlyRecordsResult.data ?? []}
      initialError={
        cardsResult.error?.message ??
        activitiesResult.error?.message ??
        paymentsResult.error?.message ??
        monthlyRecordsResult.error?.message ??
        ""
      }
    />
  );
}
