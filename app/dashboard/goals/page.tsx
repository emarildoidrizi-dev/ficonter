import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GoalsManager } from "@/components/GoalsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: goals, error: goalsError }, { data: investments, error: investmentsError }] =
    await Promise.all([
      supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("goal_investments")
        .select("*")
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
