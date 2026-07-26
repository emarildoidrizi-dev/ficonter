import { redirect } from "next/navigation";
import { FinancialIndependence } from "@/components/FinancialIndependence";
import { createClient } from "@/lib/supabase/server";
import { normalizeFinancialIndependenceInputs } from "@/lib/wealth/financialIndependence";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FinancialIndependencePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc(
    "get_financial_independence_inputs",
  );

  return (
    <FinancialIndependence
      userId={user.id}
      initialInputs={normalizeFinancialIndependenceInputs(data)}
      initialError={error?.message ?? ""}
    />
  );
}
