import { decryptVaultPayload, encryptVaultPayload, type VaultCiphertextEnvelopeV1 } from "@/lib/e2ee/vault";

export type CreditCardActivityPrivatePayloadV1 = {
  activity_type: "purchase" | "interest" | "fee" | "refund" | "adjustment_increase" | "adjustment_decrease" | "statement_adjustment";
  description: string;
  amount: number;
  currency: string;
  amount_eur: number;
  exchange_rate_to_eur: number;
  balance_effect: number;
  balance_effect_eur: number;
  notes: string | null;
};

export type EncryptedCreditCardActivityRow = {
  id: string;
  user_id: string;
  encrypted_payload: VaultCiphertextEnvelopeV1 | null;
  encryption_version: number | null;
  e2ee_revision?: number | null;
};

const TYPES = new Set(["purchase","interest","fee","refund","adjustment_increase","adjustment_decrease","statement_adjustment"]);
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function finite(value: unknown, field: string) { const parsed = Number(value); if (!Number.isFinite(parsed)) throw new Error(`Credit card activity contains an invalid ${field}.`); return parsed; }

function normalize(payload: Record<string, unknown>): CreditCardActivityPrivatePayloadV1 {
  const activityType = text(payload.activity_type);
  const description = text(payload.description);
  const currency = text(payload.currency).toUpperCase();
  if (!TYPES.has(activityType)) throw new Error("Credit card activity type is invalid.");
  if (!description) throw new Error("Credit card activity description is required.");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Credit card activity currency is invalid.");
  const amount = finite(payload.amount, "amount");
  const amountEur = finite(payload.amount_eur, "EUR amount");
  const rate = finite(payload.exchange_rate_to_eur, "exchange rate");
  const effect = finite(payload.balance_effect, "balance effect");
  const effectEur = finite(payload.balance_effect_eur, "EUR balance effect");
  if (amount <= 0 || amountEur <= 0 || rate <= 0) throw new Error("Credit card activity financial values are outside the allowed range.");
  return { activity_type: activityType as CreditCardActivityPrivatePayloadV1["activity_type"], description, amount, currency, amount_eur: amountEur, exchange_rate_to_eur: rate, balance_effect: effect, balance_effect_eur: effectEur, notes: text(payload.notes) || null };
}

export async function encryptCreditCardActivityPayload(vaultKey: CryptoKey, userId: string, activityId: string, payload: CreditCardActivityPrivatePayloadV1) {
  return encryptVaultPayload(vaultKey, userId, "credit-card-activity", activityId, normalize(payload as unknown as Record<string, unknown>));
}

export async function decryptCreditCardActivityPayload(vaultKey: CryptoKey, userId: string, row: EncryptedCreditCardActivityRow) {
  if (row.user_id !== userId) throw new Error("Encrypted credit card activity does not belong to the active user.");
  if (row.encryption_version !== 1 || !row.encrypted_payload) throw new Error("Credit card activity is not stored as encrypted v1 data.");
  return normalize(await decryptVaultPayload(vaultKey, userId, "credit-card-activity", row.id, row.encrypted_payload));
}
