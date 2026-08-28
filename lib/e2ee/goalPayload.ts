import {
  decryptVaultPayload,
  encryptVaultPayload,
  type VaultCiphertextEnvelopeV1,
} from "@/lib/e2ee/vault";

export type GoalPrivatePayloadV1 = {
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  status: "active" | "completed" | "paused";
};

export type EncryptedGoalRow = {
  id: string;
  user_id: string;
  encrypted_payload: VaultCiphertextEnvelopeV1 | null;
  encryption_version: number | null;
  e2ee_revision?: number | null;
};

function finite(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Goal payload contains an invalid ${field}.`);
  }
  return parsed;
}

function normalize(payload: Record<string, unknown>): GoalPrivatePayloadV1 {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const targetAmount = finite(payload.target_amount, "target amount");
  const currentAmount = finite(payload.current_amount, "current amount");
  const targetDate = typeof payload.target_date === "string" && payload.target_date
    ? payload.target_date
    : null;
  const status = String(payload.status ?? "active") as GoalPrivatePayloadV1["status"];

  if (!name) throw new Error("Goal name is required.");
  if (targetAmount <= 0 || currentAmount < 0 || currentAmount > targetAmount) {
    throw new Error("Goal financial values are outside the allowed range.");
  }
  if (!["active", "completed", "paused"].includes(status)) {
    throw new Error("Goal status is invalid.");
  }

  return { name, target_amount: targetAmount, current_amount: currentAmount, target_date: targetDate, status };
}

export async function encryptGoalPayload(
  vaultKey: CryptoKey,
  userId: string,
  goalId: string,
  payload: GoalPrivatePayloadV1,
): Promise<VaultCiphertextEnvelopeV1> {
  return encryptVaultPayload(vaultKey, userId, "goal", goalId, normalize(payload as unknown as Record<string, unknown>));
}

export async function decryptGoalPayload(
  vaultKey: CryptoKey,
  userId: string,
  row: EncryptedGoalRow,
): Promise<GoalPrivatePayloadV1> {
  if (row.user_id !== userId) throw new Error("Encrypted Goal does not belong to the active user.");
  if (row.encryption_version !== 1 || !row.encrypted_payload) {
    throw new Error("Goal is not stored as an encrypted v1 record.");
  }
  return normalize(await decryptVaultPayload(vaultKey, userId, "goal", row.id, row.encrypted_payload));
}
