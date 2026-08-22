import {
  decryptVaultPayload,
  encryptVaultPayload,
  type VaultCiphertextEnvelopeV1,
} from "@/lib/e2ee/vault";

export type FinancialIndependenceSettingsPrivatePayloadV1 = {
  target_monthly_spending: number;
  withdrawal_rate: number;
  annual_real_return_rate: number;
};

export type EncryptedFinancialIndependenceSettingsRow = {
  user_id: string;
  encrypted_payload: VaultCiphertextEnvelopeV1 | null;
  encryption_version: number | null;
  e2ee_revision?: number | null;
};

function finite(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Financial Independence settings contain an invalid ${field}.`);
  }
  return parsed;
}

function normalize(
  payload: Record<string, unknown>,
): FinancialIndependenceSettingsPrivatePayloadV1 {
  const targetMonthlySpending = finite(
    payload.target_monthly_spending,
    "monthly spending target",
  );
  const withdrawalRate = finite(payload.withdrawal_rate, "withdrawal rate");
  const annualRealReturnRate = finite(
    payload.annual_real_return_rate,
    "annual real return rate",
  );

  if (targetMonthlySpending <= 0) {
    throw new Error("Financial Independence monthly spending target must be greater than zero.");
  }
  if (withdrawalRate <= 0 || withdrawalRate > 20) {
    throw new Error("Financial Independence withdrawal rate is outside the allowed range.");
  }
  if (annualRealReturnRate < -20 || annualRealReturnRate > 50) {
    throw new Error("Financial Independence growth assumption is outside the allowed range.");
  }

  return {
    target_monthly_spending: targetMonthlySpending,
    withdrawal_rate: withdrawalRate,
    annual_real_return_rate: annualRealReturnRate,
  };
}

export async function encryptFinancialIndependenceSettingsPayload(
  vaultKey: CryptoKey,
  userId: string,
  payload: FinancialIndependenceSettingsPrivatePayloadV1,
): Promise<VaultCiphertextEnvelopeV1> {
  return encryptVaultPayload(
    vaultKey,
    userId,
    "financial-independence-settings",
    userId,
    normalize(payload as unknown as Record<string, unknown>),
  );
}

export async function decryptFinancialIndependenceSettingsPayload(
  vaultKey: CryptoKey,
  userId: string,
  row: EncryptedFinancialIndependenceSettingsRow,
): Promise<FinancialIndependenceSettingsPrivatePayloadV1> {
  if (row.user_id !== userId) {
    throw new Error("Encrypted Financial Independence settings do not belong to the active user.");
  }
  if (row.encryption_version !== 1 || !row.encrypted_payload) {
    throw new Error("Financial Independence settings are not stored as an encrypted v1 record.");
  }
  return normalize(
    await decryptVaultPayload(
      vaultKey,
      userId,
      "financial-independence-settings",
      userId,
      row.encrypted_payload,
    ),
  );
}
