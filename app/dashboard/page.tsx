import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardLiveOverview } from "@/components/DashboardLiveOverview";
import { normalizeFinancialHealthInputs } from "@/lib/wealth/financialHealth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [transactionResult, healthResult] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id,user_id,description,amount,currency,amount_eur,exchange_rate_to_eur,exchange_rate_date,type,category,transaction_date,occurred_at,created_at",
      )
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(250),
    supabase.rpc("get_financial_health_inputs"),
  ]);

  const name =
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    "there";

  return (
    <DashboardLiveOverview
      userId={user.id}
      name={name}
      initialTransactions={transactionResult.data ?? []}
      initialHealthInputs={normalizeFinancialHealthInputs(healthResult.data)}
      initialError={transactionResult.error?.message ?? ""}
      initialHealthError={healthResult.error?.message ?? ""}
    />
  );
}
