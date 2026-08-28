import {
  decryptVaultPayload,
  encryptVaultPayload,
  type VaultCiphertextEnvelopeV1,
} from "@/lib/e2ee/vault";

export type GoalInvestmentPrivatePayloadV1 = {
  amount: number;
  original_amount: number;
  currency: string;
  exchange_rate_to_eur: number;
  exchange_rate_date: string | null;
  notes: string | null;
};

export type EncryptedGoalInvestmentRow = {
  id: string;
  user_id: string;
  encrypted_payload: VaultCiphertextEnvelopeV1 | null;
  encryption_version: number | null;
};

function finite(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Goal investment payload contains an invalid ${field}.`);
  }
  return parsed;
}

function normalize(payload: Record<string, unknown>): GoalInvestmentPrivatePayloadV1 {
  const amount = finite(payload.amount, "amount");
  const originalAmount = finite(payload.original_amount, "original amount");
  const currency = String(payload.currency ?? "").trim().toUpperCase();
  const exchangeRate = finite(payload.exchange_rate_to_eur, "exchange rate");
  const exchangeRateDate = typeof payload.exchange_rate_date === "string" && payload.exchange_rate_date
    ? payload.exchange_rate_date
    : null;
  const notes = typeof payload.notes === "string" && payload.notes.trim() ? payload.notes.trim() : null;

  if (amount <= 0 || originalAmount <= 0 || exchangeRate <= 0) {
    throw new Error("Goal investment financial values must be positive.");
  }
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Goal investment currency is invalid.");

  return {
    amount,
    original_amount: originalAmount,
    currency,
    exchange_rate_to_eur: exchangeRate,
    exchange_rate_date: exchangeRateDate,
    notes,
  };
}

export async function encryptGoalInvestmentPayload(
  vaultKey: CryptoKey,
  userId: string,
  investmentId: string,
  payload: GoalInvestmentPrivatePayloadV1,
): Promise<VaultCiphertextEnvelopeV1> {
  return encryptVaultPayload(
    vaultKey,
    userId,
    "goal-investment",
    investmentId,
    normalize(payload as unknown as Record<string, unknown>),
  );
}

export async function decryptGoalInvestmentPayload(
  vaultKey: CryptoKey,
  userId: string,
  row: EncryptedGoalInvestmentRow,
): Promise<GoalInvestmentPrivatePayloadV1> {
  if (row.user_id !== userId) {
    throw new Error("Encrypted Goal investment does not belong to the active user.");
  }
  if (row.encryption_version !== 1 || !row.encrypted_payload) {
    throw new Error("Goal investment is not stored as an encrypted v1 record.");
  }

  return normalize(
    await decryptVaultPayload(vaultKey, userId, "goal-investment", row.id, row.encrypted_payload),
  );
}
