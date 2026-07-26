import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmergencyFundIntelligence } from "@/components/EmergencyFundIntelligence";
import { normalizeEmergencyFundInputs } from "@/lib/wealth/emergencyFund";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EmergencyFundPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc(
    "get_emergency_fund_intelligence_inputs",
  );

  return (
    <EmergencyFundIntelligence
      userId={user.id}
      initialInputs={normalizeEmergencyFundInputs(data)}
      initialError={error?.message ?? ""}
    />
  );
}
