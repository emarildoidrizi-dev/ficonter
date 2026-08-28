import {
  decryptVaultPayload,
  encryptVaultPayload,
  type VaultCiphertextEnvelopeV1,
} from "@/lib/e2ee/vault";

export type TransactionTemplatePrivatePayloadV1 = {
  label: string;
  description: string;
  amount: number;
  currency: string;
  amount_eur: number;
  exchange_rate_to_eur: number;
  exchange_rate_date: string;
  exchange_rate_source: string;
  type: "expense" | "income" | "saving";
  category: string;
};

export type EncryptedTransactionTemplateRow = {
  id: string;
  user_id: string;
  encrypted_payload: VaultCiphertextEnvelopeV1 | null;
  encryption_version: number | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function finite(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Transaction template contains an invalid ${field}.`);
  }
  return parsed;
}

function normalize(payload: Record<string, unknown>): TransactionTemplatePrivatePayloadV1 {
  const label = text(payload.label);
  const description = text(payload.description);
  const currency = text(payload.currency).toUpperCase();
  const type = text(payload.type);
  const category = text(payload.category);
  const exchangeRateDate = text(payload.exchange_rate_date);
  const exchangeRateSource = text(payload.exchange_rate_source);
  const amount = finite(payload.amount, "amount");
  const amountEur = finite(payload.amount_eur, "EUR amount");
  const rate = finite(payload.exchange_rate_to_eur, "exchange rate");

  if (!label || !description || !category) {
    throw new Error("Transaction template text fields are incomplete.");
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Transaction template currency is invalid.");
  }
  if (!["expense", "income", "saving"].includes(type)) {
    throw new Error("Transaction template type is invalid.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exchangeRateDate)) {
    throw new Error("Transaction template exchange-rate date is invalid.");
  }
  if (!exchangeRateSource || amount <= 0 || amountEur <= 0 || rate <= 0) {
    throw new Error("Transaction template financial values are invalid.");
  }

  return {
    label,
    description,
    amount,
    currency,
    amount_eur: amountEur,
    exchange_rate_to_eur: rate,
    exchange_rate_date: exchangeRateDate,
    exchange_rate_source: exchangeRateSource,
    type: type as TransactionTemplatePrivatePayloadV1["type"],
    category,
  };
}

export async function encryptTransactionTemplatePayload(
  vaultKey: CryptoKey,
  userId: string,
  templateId: string,
  payload: TransactionTemplatePrivatePayloadV1,
): Promise<VaultCiphertextEnvelopeV1> {
  return encryptVaultPayload(
    vaultKey,
    userId,
    "transaction-template",
    templateId,
    normalize(payload as unknown as Record<string, unknown>),
  );
}

export async function decryptTransactionTemplatePayload(
  vaultKey: CryptoKey,
  userId: string,
  row: EncryptedTransactionTemplateRow,
): Promise<TransactionTemplatePrivatePayloadV1> {
  if (row.user_id !== userId) {
    throw new Error("Encrypted transaction template does not belong to the active user.");
  }
  if (row.encryption_version !== 1 || !row.encrypted_payload) {
    throw new Error("Transaction template is not stored as encrypted v1 data.");
  }
  return normalize(
    await decryptVaultPayload(
      vaultKey,
      userId,
      "transaction-template",
      row.id,
      row.encrypted_payload,
    ),
  );
}
