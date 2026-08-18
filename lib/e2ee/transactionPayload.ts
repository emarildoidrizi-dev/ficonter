export type EncryptedTransactionRow = {
  id: string;
  user_id?: string;
  encrypted_payload: string | null;
  encryption_version: number | null;
  created_at?: string | null;
};

export type DecryptedTransaction = {
  id: string;
  user_id?: string;
  description: string;
  amount: number;
  currency: string;
  amount_eur: number;
  exchange_rate_to_eur: number;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
  type: string;
  category: string;
  transaction_date: string;
  occurred_at: string | null;
  created_at?: string | null;
};

type TransactionCipherEnvelopeV1 = {
  v: 1;
  alg: "A256GCM";
  iv: string;
  ct: string;
};

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function decryptTransactionPayload(
  vaultKey: CryptoKey,
  userId: string,
  row: EncryptedTransactionRow,
): Promise<DecryptedTransaction> {
  if (
    row.encryption_version !== 1 ||
    !row.encrypted_payload
  ) {
    throw new Error("Unsupported encrypted transaction.");
  }

  const envelope = JSON.parse(
    row.encrypted_payload,
  ) as TransactionCipherEnvelopeV1;

  if (
    envelope.v !== 1 ||
    envelope.alg !== "A256GCM" ||
    !envelope.iv ||
    !envelope.ct
  ) {
    throw new Error("Invalid encrypted transaction envelope.");
  }

  const additionalDataBytes = new TextEncoder().encode(
    `ficonter:transaction:${userId}:v1`,
  );

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(base64ToBytes(envelope.iv)),
      additionalData: toArrayBuffer(additionalDataBytes),
    },
    vaultKey,
    toArrayBuffer(base64ToBytes(envelope.ct)),
  );

  const payload = JSON.parse(
    new TextDecoder().decode(plaintext),
  ) as Record<string, unknown>;

  return {
    id: row.id,
    user_id: row.user_id,
    description: String(payload.description ?? ""),
    amount: Number(payload.amount ?? 0),
    currency: String(payload.currency ?? "EUR"),
    amount_eur: Number(payload.amount_eur ?? 0),
    exchange_rate_to_eur: Number(payload.exchange_rate_to_eur ?? 1),
    exchange_rate_date:
      typeof payload.exchange_rate_date === "string"
        ? payload.exchange_rate_date
        : null,
    exchange_rate_source:
      typeof payload.exchange_rate_source === "string"
        ? payload.exchange_rate_source
        : null,
    type: String(payload.type ?? "expense"),
    category: String(payload.category ?? ""),
    transaction_date: String(payload.transaction_date ?? ""),
    occurred_at:
      typeof payload.occurred_at === "string"
        ? payload.occurred_at
        : null,
    created_at: row.created_at ?? null,
  };
}