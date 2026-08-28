import {
  decryptVaultPayload,
  encryptVaultPayload,
  type VaultCiphertextEnvelopeV1,
} from "@/lib/e2ee/vault";

export type CreditCardPrivatePayloadV1 = {
  name: string;
  lender: string | null;
  description: string | null;
  card_last_four: string | null;
  currency: string;
  original_balance: number;
  current_balance: number;
  original_balance_eur: number;
  current_balance_eur: number;
  exchange_rate_to_eur: number;
  annual_interest_rate: number;
  credit_limit: number;
  credit_limit_eur: number;
  statement_balance: number | null;
  statement_balance_eur: number | null;
  minimum_payment: number;
  minimum_payment_eur: number;
  statement_date: string | null;
  payment_due_date: string | null;
  interest_charged: number;
  interest_charged_eur: number;
};

export type EncryptedCreditCardRow = {
  id: string;
  user_id: string;
  encrypted_payload: VaultCiphertextEnvelopeV1 | null;
  encryption_version: number | null;
  e2ee_revision?: number | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function finite(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Credit card payload contains an invalid ${field}.`);
  return parsed;
}

function optionalMoney(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = finite(value, field);
  if (parsed < 0) throw new Error(`${field} cannot be negative.`);
  return parsed;
}

function optionalDate(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(`${field} is invalid.`);
  return normalized;
}

function normalize(payload: Record<string, unknown>): CreditCardPrivatePayloadV1 {
  const name = text(payload.name);
  const currency = text(payload.currency).toUpperCase();
  const lastFour = text(payload.card_last_four);
  if (!name) throw new Error("Credit card name is required.");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Credit card currency is invalid.");
  if (lastFour && !/^\d{4}$/.test(lastFour)) throw new Error("Credit card last four digits are invalid.");

  const originalBalance = finite(payload.original_balance, "original balance");
  const currentBalance = finite(payload.current_balance, "current balance");
  const originalBalanceEur = finite(payload.original_balance_eur, "original EUR balance");
  const currentBalanceEur = finite(payload.current_balance_eur, "current EUR balance");
  const rate = finite(payload.exchange_rate_to_eur, "exchange rate");
  const apr = finite(payload.annual_interest_rate, "APR");
  const creditLimit = finite(payload.credit_limit, "credit limit");
  const creditLimitEur = finite(payload.credit_limit_eur, "EUR credit limit");
  const minimumPayment = finite(payload.minimum_payment, "minimum payment");
  const minimumPaymentEur = finite(payload.minimum_payment_eur, "EUR minimum payment");
  const interest = finite(payload.interest_charged, "interest charged");
  const interestEur = finite(payload.interest_charged_eur, "EUR interest charged");

  if ([originalBalance,currentBalance,originalBalanceEur,currentBalanceEur,apr,creditLimit,creditLimitEur,minimumPayment,minimumPaymentEur,interest,interestEur].some((value) => value < 0) || rate <= 0) {
    throw new Error("Credit card financial values are outside the allowed range.");
  }

  return {
    name,
    lender: text(payload.lender) || null,
    description: text(payload.description) || null,
    card_last_four: lastFour || null,
    currency,
    original_balance: originalBalance,
    current_balance: currentBalance,
    original_balance_eur: originalBalanceEur,
    current_balance_eur: currentBalanceEur,
    exchange_rate_to_eur: rate,
    annual_interest_rate: apr,
    credit_limit: creditLimit,
    credit_limit_eur: creditLimitEur,
    statement_balance: optionalMoney(payload.statement_balance, "statement balance"),
    statement_balance_eur: optionalMoney(payload.statement_balance_eur, "EUR statement balance"),
    minimum_payment: minimumPayment,
    minimum_payment_eur: minimumPaymentEur,
    statement_date: optionalDate(payload.statement_date, "statement date"),
    payment_due_date: optionalDate(payload.payment_due_date, "payment due date"),
    interest_charged: interest,
    interest_charged_eur: interestEur,
  };
}

export async function encryptCreditCardPayload(vaultKey: CryptoKey, userId: string, cardId: string, payload: CreditCardPrivatePayloadV1) {
  return encryptVaultPayload(vaultKey, userId, "credit-card", cardId, normalize(payload as unknown as Record<string, unknown>));
}

export async function decryptCreditCardPayload(vaultKey: CryptoKey, userId: string, row: EncryptedCreditCardRow) {
  if (row.user_id !== userId) throw new Error("Encrypted credit card does not belong to the active user.");
  if (row.encryption_version !== 1 || !row.encrypted_payload) throw new Error("Credit card is not stored as encrypted v1 data.");
  return normalize(await decryptVaultPayload(vaultKey, userId, "credit-card", row.id, row.encrypted_payload));
}
