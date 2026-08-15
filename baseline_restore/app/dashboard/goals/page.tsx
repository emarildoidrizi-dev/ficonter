import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { GoalsManager } from "@/components/GoalsManager";

import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GoalsPage() {
  await requireSubscriptionFeature("goals");
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const [{ data: goals, error: goalsError }, { data: investments, error: investmentsError }] =
    await Promise.all([
      supabase
        .from("goals")
        .select("id,user_id,name,target_amount,current_amount,target_date,status,created_at,updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("goal_investments")
        .select("id,goal_id,user_id,amount,invested_at,notes,transaction_id,created_at")
        .eq("user_id", user.id)
        .order("invested_at", { ascending: false }),
    ]);

  return (
    <GoalsManager
      userId={user.id}
      initialGoals={goals ?? []}
      initialInvestments={investments ?? []}
      initialError={goalsError?.message ?? investmentsError?.message ?? ""}
    />
  );
}
