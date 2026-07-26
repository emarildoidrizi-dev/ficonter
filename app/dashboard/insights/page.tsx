import { redirect } from "next/navigation";
import { AiInsights } from "@/components/AiInsights";
import { createClient } from "@/lib/supabase/server";
import {
  SMART_INSIGHTS_ENGINE_VERSION,
  calculateAiInsightsContext,
  normalizeAiInsightSnapshot,
  normalizeAiInsightsInputs,
} from "@/lib/wealth/aiInsights";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SmartInsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data, error }, { data: snapshotRows }] = await Promise.all([
    supabase.rpc("get_ai_insights_inputs"),
    supabase
      .from("ai_insight_snapshots")
      .select("id, data_fingerprint, report, model, data_coverage, generated_at")
      .eq("user_id", user.id)
      .eq("model", SMART_INSIGHTS_ENGINE_VERSION)
      .order("generated_at", { ascending: false })
      .limit(1),
  ]);

  const inputs = normalizeAiInsightsInputs(data);
  const context = calculateAiInsightsContext(inputs);
  const snapshot = normalizeAiInsightSnapshot(snapshotRows?.[0]);

  return (
    <AiInsights
      userId={user.id}
      initialInputs={inputs}
      initialSnapshot={snapshot}
      initialFingerprint={context.fingerprint}
      initialError={error?.message ?? ""}
    />
  );
}
