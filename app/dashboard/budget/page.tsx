import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { MonthlyPlanner } from "@/components/MonthlyPlanner";
import { canCurrentUserAccessSubscriptionFeature } from "@/lib/subscriptionAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BudgetPage() {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect("/login");

  const showAdvancedPosition =
    await canCurrentUserAccessSubscriptionFeature(
      "planner_left_after_everything_paid",
    );

  const [billResult, planResult, itemResult, goalResult] = await Promise.all([
    supabase.from("bills").select("id,user_id,name,category,amount,currency,amount_eur,due_date,status,paid_at,transaction_id").eq("user_id", user.id),
    supabase.from("monthly_budget_plans").select("id,user_id,month,start_balance,spending_budget,created_at,updated_at").eq("user_id", user.id).order("month", { ascending: false }),
    supabase.from("monthly_budget_items").select("id,user_id,month,section,label,planned_amount,position,created_at,updated_at").eq("user_id", user.id).order("position", { ascending: true }),
    supabase.from("goals").select("id,user_id,name,target_amount,current_amount,target_date,status,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: true }),
  ]);

  const plannerError =
    billResult.error?.message ??
    planResult.error?.message ??
    itemResult.error?.message ??
    goalResult.error?.message ??
    "";

  return <MonthlyPlanner userId={user.id} initialTransactions={[]} initialBills={billResult.data ?? []} initialPlans={planResult.data ?? []} initialItems={itemResult.data ?? []} initialGoals={goalResult.data ?? []} initialError={plannerError} showAdvancedPosition={showAdvancedPosition} />;
}
