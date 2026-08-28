import {
  decryptVaultPayload,
  encryptVaultPayload,
  type VaultCiphertextEnvelopeV1,
} from "@/lib/e2ee/vault";
import {
  normalizeAiInsightReport,
  type AiInsightReport,
} from "@/lib/wealth/aiInsights";

export type AiInsightSnapshotPrivatePayloadV1 = {
  data_fingerprint: string;
  report: AiInsightReport;
  data_coverage: number;
};

export type EncryptedAiInsightSnapshotRow = {
  id: string;
  user_id: string;
  encrypted_payload: VaultCiphertextEnvelopeV1 | null;
  encryption_version: number | null;
};

function normalize(
  payload: Record<string, unknown>,
): AiInsightSnapshotPrivatePayloadV1 {
  const fingerprint = typeof payload.data_fingerprint === "string"
    ? payload.data_fingerprint.trim()
    : "";
  const report = normalizeAiInsightReport(payload.report);
  const coverage = Number(payload.data_coverage);

  if (!fingerprint) throw new Error("Smart Insight snapshot fingerprint is required.");
  if (!report) throw new Error("Smart Insight snapshot report is invalid.");
  if (!Number.isFinite(coverage) || coverage < 0 || coverage > 100) {
    throw new Error("Smart Insight snapshot coverage is invalid.");
  }

  return {
    data_fingerprint: fingerprint,
    report,
    data_coverage: Math.round(coverage),
  };
}

export async function encryptAiInsightSnapshotPayload(
  vaultKey: CryptoKey,
  userId: string,
  snapshotId: string,
  payload: AiInsightSnapshotPrivatePayloadV1,
): Promise<VaultCiphertextEnvelopeV1> {
  return encryptVaultPayload(
    vaultKey,
    userId,
    "ai-insight-snapshot",
    snapshotId,
    normalize(payload as unknown as Record<string, unknown>),
  );
}

export async function decryptAiInsightSnapshotPayload(
  vaultKey: CryptoKey,
  userId: string,
  row: EncryptedAiInsightSnapshotRow,
): Promise<AiInsightSnapshotPrivatePayloadV1> {
  if (row.user_id !== userId) {
    throw new Error("Encrypted Smart Insight snapshot does not belong to the active user.");
  }
  if (row.encryption_version !== 1 || !row.encrypted_payload) {
    throw new Error("Smart Insight snapshot is not stored as an encrypted v1 record.");
  }
  return normalize(
    await decryptVaultPayload(
      vaultKey,
      userId,
      "ai-insight-snapshot",
      row.id,
      row.encrypted_payload,
    ),
  );
}
