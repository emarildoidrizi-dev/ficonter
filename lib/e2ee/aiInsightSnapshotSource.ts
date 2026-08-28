import {
  AI_INSIGHTS_CACHE_HOURS,
  SMART_INSIGHTS_ENGINE_VERSION,
  normalizeAiInsightSnapshot,
  type AiInsightSnapshot,
  type AiInsightsContext,
} from "@/lib/wealth/aiInsights";
import {
  decryptAiInsightSnapshotPayload,
  encryptAiInsightSnapshotPayload,
} from "@/lib/e2ee/aiInsightSnapshotPayload";

function ageMilliseconds(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp)
    ? Math.max(0, Date.now() - timestamp)
    : Number.POSITIVE_INFINITY;
}

async function openSnapshot(
  vaultKey: CryptoKey,
  userId: string,
  row: any,
): Promise<AiInsightSnapshot | null> {
  if (!row) return null;

  if (row.encryption_version === 1 && row.encrypted_payload) {
    const opened = await decryptAiInsightSnapshotPayload(vaultKey, userId, row);
    return normalizeAiInsightSnapshot({
      id: row.id,
      data_fingerprint: opened.data_fingerprint,
      report: opened.report,
      model: row.model,
      data_coverage: opened.data_coverage,
      generated_at: row.generated_at,
    });
  }

  return normalizeAiInsightSnapshot(row);
}

export async function loadLatestAiInsightSnapshotFromVault(
  client: any,
  vaultKey: CryptoKey,
  userId: string,
): Promise<AiInsightSnapshot | null> {
  const result = await client
    .from("ai_insight_snapshots")
    .select("id,user_id,data_fingerprint,report,model,data_coverage,generated_at,encrypted_payload,encryption_version,e2ee_revision")
    .eq("user_id", userId)
    .eq("model", SMART_INSIGHTS_ENGINE_VERSION)
    .order("generated_at", { ascending: false })
    .limit(1);
  if (result.error) throw result.error;
  return openSnapshot(vaultKey, userId, result.data?.[0]);
}

export async function saveAiInsightSnapshotToVault(
  client: any,
  vaultKey: CryptoKey,
  userId: string,
  context: AiInsightsContext,
  report: AiInsightSnapshot["report"],
): Promise<{ snapshot: AiInsightSnapshot; cached: boolean }> {
  const latest = await loadLatestAiInsightSnapshotFromVault(
    client,
    vaultKey,
    userId,
  );
  if (
    latest &&
    latest.dataFingerprint === context.fingerprint &&
    ageMilliseconds(latest.generatedAt) <
      AI_INSIGHTS_CACHE_HOURS * 60 * 60 * 1000
  ) {
    return { snapshot: latest, cached: true };
  }

  const id = crypto.randomUUID();
  const generatedAt = new Date().toISOString();
  const cipher = await encryptAiInsightSnapshotPayload(
    vaultKey,
    userId,
    id,
    {
      data_fingerprint: context.fingerprint,
      report,
      data_coverage: context.dataCoverage,
    },
  );

  const result = await client
    .from("ai_insight_snapshots")
    .insert({
      id,
      user_id: userId,
      data_fingerprint: null,
      report: null,
      model: SMART_INSIGHTS_ENGINE_VERSION,
      data_coverage: null,
      generated_at: generatedAt,
      encrypted_payload: cipher,
      encryption_version: 1,
      e2ee_revision: 0,
    })
    .select("id,user_id,model,generated_at,encrypted_payload,encryption_version,e2ee_revision")
    .single();
  if (result.error) throw result.error;

  const snapshot = normalizeAiInsightSnapshot({
    id,
    data_fingerprint: context.fingerprint,
    report,
    model: SMART_INSIGHTS_ENGINE_VERSION,
    data_coverage: context.dataCoverage,
    generated_at: result.data?.generated_at ?? generatedAt,
  });
  if (!snapshot) throw new Error("Encrypted Smart Insight snapshot could not be displayed.");

  const older = await client
    .from("ai_insight_snapshots")
    .select("id")
    .eq("user_id", userId)
    .eq("model", SMART_INSIGHTS_ENGINE_VERSION)
    .order("generated_at", { ascending: false })
    .range(12, 200);
  const olderIds = (older.data ?? [])
    .map((row: any) => row.id)
    .filter((value: unknown): value is string => typeof value === "string");
  if (olderIds.length) {
    await client
      .from("ai_insight_snapshots")
      .delete()
      .eq("user_id", userId)
      .in("id", olderIds);
  }

  return { snapshot, cached: false };
}

export async function clearAiInsightSnapshots(
  client: any,
  userId: string,
) {
  const result = await client
    .from("ai_insight_snapshots")
    .delete()
    .eq("user_id", userId);
  if (result.error) throw result.error;
}
