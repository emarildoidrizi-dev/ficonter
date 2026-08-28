import {
  decryptVaultPayload,
  encryptVaultPayload,
  type VaultCiphertextEnvelopeV1,
} from "@/lib/e2ee/vault";

export type MonthlyPlanPrivatePayloadV1 = {
  start_balance: number;
  spending_budget: number;
};

export type EncryptedMonthlyPlanRow = {
  id: string;
  user_id: string;
  month: string;
  encrypted_payload: VaultCiphertextEnvelopeV1 | null;
  encryption_version: number | null;
  e2ee_revision?: number | null;
};

function finite(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Monthly Planner payload contains an invalid ${field}.`);
  return parsed;
}

function normalize(payload: Record<string, unknown>): MonthlyPlanPrivatePayloadV1 {
  const startBalance = finite(payload.start_balance, "start balance");
  const spendingBudget = finite(payload.spending_budget, "spending budget");
  if (spendingBudget < 0) throw new Error("Monthly spending budget cannot be negative.");
  return { start_balance: startBalance, spending_budget: spendingBudget };
}

export async function encryptMonthlyPlanPayload(
  vaultKey: CryptoKey,
  userId: string,
  planId: string,
  payload: MonthlyPlanPrivatePayloadV1,
): Promise<VaultCiphertextEnvelopeV1> {
  return encryptVaultPayload(vaultKey, userId, "monthly-plan", planId, normalize(payload as unknown as Record<string, unknown>));
}

export async function decryptMonthlyPlanPayload(
  vaultKey: CryptoKey,
  userId: string,
  row: EncryptedMonthlyPlanRow,
): Promise<MonthlyPlanPrivatePayloadV1> {
  if (row.user_id !== userId) throw new Error("Encrypted Monthly Planner plan does not belong to the active user.");
  if (row.encryption_version !== 1 || !row.encrypted_payload) throw new Error("Monthly Planner plan is not stored as encrypted v1 data.");
  return normalize(await decryptVaultPayload(vaultKey, userId, "monthly-plan", row.id, row.encrypted_payload));
}
