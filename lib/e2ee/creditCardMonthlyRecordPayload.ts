import { decryptVaultPayload, encryptVaultPayload, type VaultCiphertextEnvelopeV1 } from "@/lib/e2ee/vault";

export type CreditCardMonthlyRecordPrivatePayloadV1 = {
  currency: string;
  statement_balance: number;
  statement_balance_eur: number;
  minimum_payment: number;
  minimum_payment_eur: number;
  interest_charged: number;
  interest_charged_eur: number;
  statement_date: string;
  payment_due_date: string;
};

export type EncryptedCreditCardMonthlyRecordRow = {
  id: string;
  user_id: string;
  encrypted_payload: VaultCiphertextEnvelopeV1 | null;
  encryption_version: number | null;
  e2ee_revision?: number | null;
};

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function finite(value: unknown, field: string) { const parsed = Number(value); if (!Number.isFinite(parsed)) throw new Error(`Credit card monthly record contains an invalid ${field}.`); return parsed; }
function date(value: unknown, field: string) { const normalized = text(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(`${field} is invalid.`); return normalized; }

function normalize(payload: Record<string, unknown>): CreditCardMonthlyRecordPrivatePayloadV1 {
  const currency = text(payload.currency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Credit card monthly record currency is invalid.");
  const statement = finite(payload.statement_balance, "statement balance");
  const statementEur = finite(payload.statement_balance_eur, "EUR statement balance");
  const minimum = finite(payload.minimum_payment, "minimum payment");
  const minimumEur = finite(payload.minimum_payment_eur, "EUR minimum payment");
  const interest = finite(payload.interest_charged, "interest charged");
  const interestEur = finite(payload.interest_charged_eur, "EUR interest charged");
  if ([statement, statementEur, minimum, minimumEur, interest, interestEur].some((value) => value < 0)) throw new Error("Credit card monthly record financial values cannot be negative.");
  return { currency, statement_balance: statement, statement_balance_eur: statementEur, minimum_payment: minimum, minimum_payment_eur: minimumEur, interest_charged: interest, interest_charged_eur: interestEur, statement_date: date(payload.statement_date, "statement date"), payment_due_date: date(payload.payment_due_date, "payment due date") };
}

export async function encryptCreditCardMonthlyRecordPayload(vaultKey: CryptoKey, userId: string, recordId: string, payload: CreditCardMonthlyRecordPrivatePayloadV1) {
  return encryptVaultPayload(vaultKey, userId, "credit-card-monthly-record", recordId, normalize(payload as unknown as Record<string, unknown>));
}

export async function decryptCreditCardMonthlyRecordPayload(vaultKey: CryptoKey, userId: string, row: EncryptedCreditCardMonthlyRecordRow) {
  if (row.user_id !== userId) throw new Error("Encrypted credit card monthly record does not belong to the active user.");
  if (row.encryption_version !== 1 || !row.encrypted_payload) throw new Error("Credit card monthly record is not stored as encrypted v1 data.");
  return normalize(await decryptVaultPayload(vaultKey, userId, "credit-card-monthly-record", row.id, row.encrypted_payload));
}
