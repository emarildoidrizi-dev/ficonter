import {
  decryptVaultPayload,
  encryptVaultPayload,
  type VaultCiphertextEnvelopeV1,
} from "@/lib/e2ee/vault";

export type BillPrivatePayloadV1 = {
  name: string;
  company: string | null;
  category: string;
  amount: number;
  currency: string;
  amount_eur: number;
  exchange_rate_to_eur: number;
  payment_method: string | null;
  notes: string | null;
};

export type EncryptedBillRow = {
  id: string;
  user_id: string;
  encrypted_payload: VaultCiphertextEnvelopeV1 | null;
  encryption_version: number | null;
};

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finite(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Bill payload contains an invalid financial number.");
  }
  return parsed;
}

function normalizePayload(
  payload: Record<string, unknown>,
): BillPrivatePayloadV1 {
  const name = normalizedText(payload.name);
  const category = normalizedText(payload.category);
  const currency = normalizedText(payload.currency).toUpperCase();

  if (!name) throw new Error("Bill name is required.");
  if (!category) throw new Error("Bill category is required.");
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Bill currency is invalid.");
  }

  const amount = finite(payload.amount);
  const amountEur = finite(payload.amount_eur);
  const rate = finite(payload.exchange_rate_to_eur);

  if (amount <= 0 || amountEur <= 0 || rate <= 0) {
    throw new Error("Bill financial values must be greater than zero.");
  }

  return {
    name,
    company: normalizedText(payload.company) || null,
    category,
    amount,
    currency,
    amount_eur: amountEur,
    exchange_rate_to_eur: rate,
    payment_method: normalizedText(payload.payment_method) || null,
    notes: normalizedText(payload.notes) || null,
  };
}

export async function encryptBillPayload(
  vaultKey: CryptoKey,
  userId: string,
  billId: string,
  payload: BillPrivatePayloadV1,
): Promise<VaultCiphertextEnvelopeV1> {
  return encryptVaultPayload(
    vaultKey,
    userId,
    "bill",
    billId,
    normalizePayload(
      payload as unknown as Record<string, unknown>,
    ),
  );
}

export async function decryptBillPayload(
  vaultKey: CryptoKey,
  userId: string,
  row: EncryptedBillRow,
): Promise<BillPrivatePayloadV1> {
  if (row.user_id !== userId) {
    throw new Error("Encrypted Bill does not belong to the active user.");
  }

  if (
    row.encryption_version !== 1 ||
    !row.encrypted_payload
  ) {
    throw new Error("Bill is not stored as an encrypted v1 record.");
  }

  const decrypted = await decryptVaultPayload(
    vaultKey,
    userId,
    "bill",
    row.id,
    row.encrypted_payload,
  );

  return normalizePayload(decrypted);
}
