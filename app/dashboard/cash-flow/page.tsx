import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { CashFlowIntelligence } from "@/components/CashFlowIntelligence";
import { normalizeCashFlowIntelligenceInputs } from "@/lib/wealth/cashFlowIntelligence";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CashFlowPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc(
    "get_cash_flow_intelligence_inputs",
  );

  return (
    <CashFlowIntelligence
      userId={user.id}
      initialInputs={normalizeCashFlowIntelligenceInputs(data)}
      initialError={error?.message ?? ""}
    />
  );
}
