import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MonthlyPlanner } from "@/components/MonthlyPlanner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BudgetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: transactions }, { data: bills }, { data: plans }, { data: items }, { data: goals }] = await Promise.all([
    supabase.from("transactions").select("id,user_id,description,amount_eur,type,category,transaction_date,occurred_at").order("occurred_at", { ascending: false }),
    supabase.from("bills").select("id,user_id,name,category,amount_eur,due_date,status,paid_at,transaction_id"),
    supabase.from("monthly_budget_plans").select("*").order("month", { ascending: false }),
    supabase.from("monthly_budget_items").select("*").order("position", { ascending: true }),
    supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
  ]);

  return <MonthlyPlanner userId={user.id} initialTransactions={transactions ?? []} initialBills={bills ?? []} initialPlans={plans ?? []} initialItems={items ?? []} initialGoals={goals ?? []} />;
}
