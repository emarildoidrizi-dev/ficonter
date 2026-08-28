import {
  decryptVaultPayload,
  encryptVaultPayload,
  type VaultCiphertextEnvelopeV1,
} from "@/lib/e2ee/vault";

export type MonthlyPlanItemPrivatePayloadV1 = {
  section: "income" | "bills" | "expenses" | "savings" | "debt";
  label: string;
  planned_amount: number;
};

export type EncryptedMonthlyPlanItemRow = {
  id: string;
  user_id: string;
  month: string;
  encrypted_payload: VaultCiphertextEnvelopeV1 | null;
  encryption_version: number | null;
  e2ee_revision?: number | null;
};

function finite(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Monthly Planner item contains an invalid ${field}.`);
  return parsed;
}

function normalize(payload: Record<string, unknown>): MonthlyPlanItemPrivatePayloadV1 {
  const section = String(payload.section ?? "") as MonthlyPlanItemPrivatePayloadV1["section"];
  const label = typeof payload.label === "string" ? payload.label.trim() : "";
  const plannedAmount = finite(payload.planned_amount, "planned amount");
  if (!["income", "bills", "expenses", "savings", "debt"].includes(section)) throw new Error("Monthly Planner section is invalid.");
  if (!label || label.length > 120) throw new Error("Monthly Planner item label is invalid.");
  if (plannedAmount < 0) throw new Error("Monthly Planner planned amount cannot be negative.");
  return { section, label, planned_amount: plannedAmount };
}

export async function encryptMonthlyPlanItemPayload(
  vaultKey: CryptoKey,
  userId: string,
  itemId: string,
  payload: MonthlyPlanItemPrivatePayloadV1,
): Promise<VaultCiphertextEnvelopeV1> {
  return encryptVaultPayload(vaultKey, userId, "monthly-plan-item", itemId, normalize(payload as unknown as Record<string, unknown>));
}

export async function decryptMonthlyPlanItemPayload(
  vaultKey: CryptoKey,
  userId: string,
  row: EncryptedMonthlyPlanItemRow,
): Promise<MonthlyPlanItemPrivatePayloadV1> {
  if (row.user_id !== userId) throw new Error("Encrypted Monthly Planner item does not belong to the active user.");
  if (row.encryption_version !== 1 || !row.encrypted_payload) throw new Error("Monthly Planner item is not stored as encrypted v1 data.");
  return normalize(await decryptVaultPayload(vaultKey, userId, "monthly-plan-item", row.id, row.encrypted_payload));
}
