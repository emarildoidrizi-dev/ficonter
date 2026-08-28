import {
  decryptVaultPayload,
  encryptVaultPayload,
  type VaultCiphertextEnvelopeV1,
} from "@/lib/e2ee/vault";

export type DebtPaymentPrivatePayloadV1 = {
  amount: number;
  currency: string;
  amount_eur: number;
  exchange_rate_to_eur: number;
  notes: string | null;
};

export type EncryptedDebtPaymentRow = {
  id: string;
  user_id: string;
  encrypted_payload: VaultCiphertextEnvelopeV1 | null;
  encryption_version: number | null;
};

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finite(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Debt payment payload contains an invalid ${field}.`);
  }
  return parsed;
}

function normalizePayload(
  payload: Record<string, unknown>,
): DebtPaymentPrivatePayloadV1 {
  const currency = normalizedText(payload.currency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Debt payment currency is invalid.");
  }

  const amount = finite(payload.amount, "amount");
  const amountEur = finite(payload.amount_eur, "EUR amount");
  const rate = finite(payload.exchange_rate_to_eur, "exchange rate");

  if (amount <= 0 || amountEur <= 0 || rate <= 0) {
    throw new Error("Debt payment financial values must be greater than zero.");
  }

  return {
    amount,
    currency,
    amount_eur: amountEur,
    exchange_rate_to_eur: rate,
    notes: normalizedText(payload.notes) || null,
  };
}

export async function encryptDebtPaymentPayload(
  vaultKey: CryptoKey,
  userId: string,
  paymentId: string,
  payload: DebtPaymentPrivatePayloadV1,
): Promise<VaultCiphertextEnvelopeV1> {
  return encryptVaultPayload(
    vaultKey,
    userId,
    "debt-payment",
    paymentId,
    normalizePayload(payload as unknown as Record<string, unknown>),
  );
}

export async function decryptDebtPaymentPayload(
  vaultKey: CryptoKey,
  userId: string,
  row: EncryptedDebtPaymentRow,
): Promise<DebtPaymentPrivatePayloadV1> {
  if (row.user_id !== userId) {
    throw new Error("Encrypted Debt payment does not belong to the active user.");
  }

  if (row.encryption_version !== 1 || !row.encrypted_payload) {
    throw new Error("Debt payment is not stored as an encrypted v1 record.");
  }

  const decrypted = await decryptVaultPayload(
    vaultKey,
    userId,
    "debt-payment",
    row.id,
    row.encrypted_payload,
  );

  return normalizePayload(decrypted);
}
