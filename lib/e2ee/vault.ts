// FICONTER Zero-Knowledge Financial Vault
// Client-side cryptographic foundation.
//
// SECURITY RULES:
// - Vault keys are created only in the user's browser.
// - The readable vault key must never be sent to FICONTER or Supabase.
// - Supabase may store only wrapped vault keys and encrypted ciphertext.
// - Financial payloads use AES-256-GCM authenticated encryption.

const VAULT_VERSION = 1 as const;
const RECOVERY_PREFIX = "FICONTER-RECOVERY-1.";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type WrappedVaultKeyEnvelopeV1 = {
  v: 1;
  alg: "A256GCM";
  kdf: "HKDF-SHA256";
  salt: string;
  iv: string;
  ct: string;
};

export type VaultCiphertextEnvelopeV1 = {
  v: 1;
  alg: "A256GCM";
  iv: string;
  ct: string;
};

export type NewVaultResult = {
  vaultKey: CryptoKey;
  recoveryCode: string;
  wrappedVaultKey: WrappedVaultKeyEnvelopeV1;
};

function requireWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API is not available.");
  }

  return globalThis.crypto;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );

  const binary = atob(padded);

  return Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  );
}

function randomBytes(length: number): Uint8Array {
  return requireWebCrypto().getRandomValues(
    new Uint8Array(length),
  );
}

function vaultKeyWrapAdditionalData(
  userId: string,
): Uint8Array {
  return textEncoder.encode(
    `ficonter:vault-key:${userId}:v${VAULT_VERSION}`,
  );
}

function payloadAdditionalData(
  userId: string,
  recordType: string,
  recordId: string,
): Uint8Array {
  return textEncoder.encode(
    `ficonter:vault:${userId}:${recordType}:${recordId}:v${VAULT_VERSION}`,
  );
}

async function importVaultKey(
  rawKey: Uint8Array,
): Promise<CryptoKey> {
  if (rawKey.length !== 32) {
    throw new Error("Invalid vault key length.");
  }

  return requireWebCrypto().subtle.importKey(
    "raw",
    toArrayBuffer(rawKey),
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

function createRecoveryCode(): {
  code: string;
  secretBytes: Uint8Array;
} {
  const secretBytes = randomBytes(32);

  return {
    code:
      RECOVERY_PREFIX +
      bytesToBase64Url(secretBytes),
    secretBytes,
  };
}

function recoveryCodeToBytes(
  recoveryCode: string,
): Uint8Array {
  if (!recoveryCode.startsWith(RECOVERY_PREFIX)) {
    throw new Error(
      "Invalid FICONTER recovery code.",
    );
  }

  const encoded = recoveryCode.slice(
    RECOVERY_PREFIX.length,
  );

  const bytes = base64UrlToBytes(encoded);

  if (bytes.length !== 32) {
    throw new Error(
      "Invalid FICONTER recovery code.",
    );
  }

  return bytes;
}

async function deriveRecoveryWrappingKey(
  recoverySecret: Uint8Array,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const cryptoApi = requireWebCrypto();

  const keyMaterial =
    await cryptoApi.subtle.importKey(
      "raw",
      toArrayBuffer(recoverySecret),
      "HKDF",
      false,
      ["deriveKey"],
    );

  return cryptoApi.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      info: toArrayBuffer(
        textEncoder.encode(
          "ficonter:vault-recovery-wrap:v1",
        ),
      ),
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function createNewVault(
  userId: string,
): Promise<NewVaultResult> {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const cryptoApi = requireWebCrypto();

  // Generate a completely random 256-bit financial vault key.
  const rawVaultKey = randomBytes(32);

  const vaultKey =
    await importVaultKey(rawVaultKey);

  // Generate an independent random recovery secret.
  const {
    code: recoveryCode,
    secretBytes: recoverySecret,
  } = createRecoveryCode();

  // Unique values used when wrapping this vault key.
  const salt = randomBytes(16);
  const iv = randomBytes(12);

  try {
    const wrappingKey =
      await deriveRecoveryWrappingKey(
        recoverySecret,
        salt,
      );

    const wrapped =
      await cryptoApi.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: toArrayBuffer(iv),
          additionalData: toArrayBuffer(
            vaultKeyWrapAdditionalData(userId),
          ),
        },
        wrappingKey,
        toArrayBuffer(rawVaultKey),
      );

    return {
      vaultKey,
      recoveryCode,

      // This object is safe to store in Supabase.
      // It does NOT contain the readable vault key.
      wrappedVaultKey: {
        v: 1,
        alg: "A256GCM",
        kdf: "HKDF-SHA256",
        salt: bytesToBase64Url(salt),
        iv: bytesToBase64Url(iv),
        ct: bytesToBase64Url(
          new Uint8Array(wrapped),
        ),
      },
    };
  } finally {
    // Best-effort cleanup of temporary readable bytes.
    rawVaultKey.fill(0);
    recoverySecret.fill(0);
  }
}

export async function unlockVaultWithRecovery(
  userId: string,
  recoveryCode: string,
  envelope: WrappedVaultKeyEnvelopeV1,
): Promise<CryptoKey> {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (
    envelope.v !== 1 ||
    envelope.alg !== "A256GCM" ||
    envelope.kdf !== "HKDF-SHA256"
  ) {
    throw new Error(
      "Unsupported FICONTER vault format.",
    );
  }

  const cryptoApi = requireWebCrypto();

  const recoverySecret =
    recoveryCodeToBytes(recoveryCode);

  const salt =
    base64UrlToBytes(envelope.salt);

  const iv =
    base64UrlToBytes(envelope.iv);

  const ciphertext =
    base64UrlToBytes(envelope.ct);

  try {
    const wrappingKey =
      await deriveRecoveryWrappingKey(
        recoverySecret,
        salt,
      );

    const decrypted =
      await cryptoApi.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: toArrayBuffer(iv),
          additionalData: toArrayBuffer(
            vaultKeyWrapAdditionalData(userId),
          ),
        },
        wrappingKey,
        toArrayBuffer(ciphertext),
      );

    const rawVaultKey =
      new Uint8Array(decrypted);

    try {
      if (rawVaultKey.length !== 32) {
        throw new Error(
          "Recovered vault key is invalid.",
        );
      }

      return await importVaultKey(
        rawVaultKey,
      );
    } finally {
      rawVaultKey.fill(0);
    }
  } finally {
    recoverySecret.fill(0);
  }
}

export async function encryptVaultPayload(
  vaultKey: CryptoKey,
  userId: string,
  recordType: string,
  recordId: string,
  payload: Record<string, unknown>,
): Promise<VaultCiphertextEnvelopeV1> {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (!recordType) {
    throw new Error(
      "Record type is required.",
    );
  }

  if (!recordId) {
    throw new Error(
      "Record ID is required.",
    );
  }

  const cryptoApi = requireWebCrypto();

  const iv = randomBytes(12);

  const plaintext = textEncoder.encode(
    JSON.stringify(payload),
  );

  try {
    const ciphertext =
      await cryptoApi.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: toArrayBuffer(iv),
          additionalData: toArrayBuffer(
            payloadAdditionalData(
              userId,
              recordType,
              recordId,
            ),
          ),
        },
        vaultKey,
        toArrayBuffer(plaintext),
      );

    return {
      v: 1,
      alg: "A256GCM",
      iv: bytesToBase64Url(iv),
      ct: bytesToBase64Url(
        new Uint8Array(ciphertext),
      ),
    };
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptVaultPayload(
  vaultKey: CryptoKey,
  userId: string,
  recordType: string,
  recordId: string,
  envelope: VaultCiphertextEnvelopeV1,
): Promise<Record<string, unknown>> {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (!recordType) {
    throw new Error(
      "Record type is required.",
    );
  }

  if (!recordId) {
    throw new Error(
      "Record ID is required.",
    );
  }

  if (
    envelope.v !== 1 ||
    envelope.alg !== "A256GCM"
  ) {
    throw new Error(
      "Unsupported encrypted payload format.",
    );
  }

  const cryptoApi = requireWebCrypto();

  const iv =
    base64UrlToBytes(envelope.iv);

  const ciphertext =
    base64UrlToBytes(envelope.ct);

  const decrypted =
    await cryptoApi.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(
          payloadAdditionalData(
            userId,
            recordType,
            recordId,
          ),
        ),
      },
      vaultKey,
      toArrayBuffer(ciphertext),
    );

  const plaintext =
    new Uint8Array(decrypted);

  try {
    return JSON.parse(
      textDecoder.decode(plaintext),
    ) as Record<string, unknown>;
  } finally {
    plaintext.fill(0);
  }
}