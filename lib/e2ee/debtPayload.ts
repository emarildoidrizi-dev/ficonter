import {
  decryptVaultPayload,
  encryptVaultPayload,
  type VaultCiphertextEnvelopeV1,
} from "@/lib/e2ee/vault";

export type DebtPrivatePayloadV1 = {
  name: string;
  lender: string | null;
  description: string | null;
  category: string;
  original_balance: number;
  current_balance: number;
  currency: string;
  original_balance_eur: number;
  current_balance_eur: number;
  exchange_rate_to_eur: number;
  annual_interest_rate: number;
  minimum_payment: number;
  minimum_payment_eur: number;
};

export type EncryptedDebtRow = {
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
    throw new Error(`Debt payload contains an invalid ${field}.`);
  }
  return parsed;
}

function normalizePayload(
  payload: Record<string, unknown>,
): DebtPrivatePayloadV1 {
  const name = normalizedText(payload.name);
  const category = normalizedText(payload.category);
  const currency = normalizedText(payload.currency).toUpperCase();

  if (!name) throw new Error("Debt name is required.");
  if (!category) throw new Error("Debt category is required.");
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Debt currency is invalid.");
  }

  const originalBalance = finite(payload.original_balance, "original balance");
  const currentBalance = finite(payload.current_balance, "current balance");
  const originalBalanceEur = finite(payload.original_balance_eur, "original EUR balance");
  const currentBalanceEur = finite(payload.current_balance_eur, "current EUR balance");
  const rate = finite(payload.exchange_rate_to_eur, "exchange rate");
  const annualInterestRate = finite(payload.annual_interest_rate, "annual interest rate");
  const minimumPayment = finite(payload.minimum_payment, "minimum payment");
  const minimumPaymentEur = finite(payload.minimum_payment_eur, "minimum EUR payment");

  if (
    originalBalance <= 0 ||
    currentBalance < 0 ||
    originalBalanceEur <= 0 ||
    currentBalanceEur < 0 ||
    rate <= 0 ||
    annualInterestRate < 0 ||
    minimumPayment < 0 ||
    minimumPaymentEur < 0
  ) {
    throw new Error("Debt financial values are outside the allowed range.");
  }

  return {
    name,
    lender: normalizedText(payload.lender) || null,
    description: normalizedText(payload.description) || null,
    category,
    original_balance: originalBalance,
    current_balance: currentBalance,
    currency,
    original_balance_eur: originalBalanceEur,
    current_balance_eur: currentBalanceEur,
    exchange_rate_to_eur: rate,
    annual_interest_rate: annualInterestRate,
    minimum_payment: minimumPayment,
    minimum_payment_eur: minimumPaymentEur,
  };
}

export async function encryptDebtPayload(
  vaultKey: CryptoKey,
  userId: string,
  debtId: string,
  payload: DebtPrivatePayloadV1,
): Promise<VaultCiphertextEnvelopeV1> {
  return encryptVaultPayload(
    vaultKey,
    userId,
    "debt",
    debtId,
    normalizePayload(payload as unknown as Record<string, unknown>),
  );
}

export async function decryptDebtPayload(
  vaultKey: CryptoKey,
  userId: string,
  row: EncryptedDebtRow,
): Promise<DebtPrivatePayloadV1> {
  if (row.user_id !== userId) {
    throw new Error("Encrypted Debt does not belong to the active user.");
  }

  if (row.encryption_version !== 1 || !row.encrypted_payload) {
    throw new Error("Debt is not stored as an encrypted v1 record.");
  }

  const decrypted = await decryptVaultPayload(
    vaultKey,
    userId,
    "debt",
    row.id,
    row.encrypted_payload,
  );

  return normalizePayload(decrypted);
}
