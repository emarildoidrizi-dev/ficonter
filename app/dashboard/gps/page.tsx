import { redirect } from "next/navigation";
import { FinancialGps } from "@/components/FinancialGps";
import { createClient } from "@/lib/supabase/server";
import { normalizeAiInsightsInputs } from "@/lib/wealth/aiInsights";
import { readSetupAcknowledgements } from "@/lib/wealth/setupReadiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FinancialGpsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("get_ai_insights_inputs");

  return (
    <FinancialGps
      userId={user.id}
      initialInputs={normalizeAiInsightsInputs(data)}
      initialAcknowledgements={readSetupAcknowledgements(user.user_metadata)}
      initialError={error?.message ?? ""}
    />
  );
}
