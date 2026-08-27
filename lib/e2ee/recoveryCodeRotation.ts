// FICONTER Financial Vault recovery-code rotation.
//
// SECURITY RULES:
// - This module rotates ONLY the customer recovery credential.
// - The underlying 256-bit Vault key remains exactly the same.
// - Readable Vault-key bytes exist only transiently in the customer's browser.
// - The readable Vault key is never sent to FICONTER or Supabase.
// - The old recovery code becomes unable to unwrap the newly persisted envelope.

import type { WrappedVaultKeyEnvelopeV1 } from "@/lib/e2ee/vault";

const RECOVERY_PREFIX = "FICONTER-RECOVERY-1.";
const textEncoder = new TextEncoder();

type RotatedRecoveryMaterial = {
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
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomBytes(length: number): Uint8Array {
  return requireWebCrypto().getRandomValues(new Uint8Array(length));
}

function recoveryCodeToBytes(recoveryCode: string): Uint8Array {
  const normalized = recoveryCode.trim();
  if (!normalized.startsWith(RECOVERY_PREFIX)) {
    throw new Error("Invalid FICONTER recovery code.");
  }
  const bytes = base64UrlToBytes(normalized.slice(RECOVERY_PREFIX.length));
  if (bytes.length !== 32) {
    throw new Error("Invalid FICONTER recovery code.");
  }
  return bytes;
}

function createRecoveryCode(): { code: string; secretBytes: Uint8Array } {
  const secretBytes = randomBytes(32);
  return {
    code: RECOVERY_PREFIX + bytesToBase64Url(secretBytes),
    secretBytes,
  };
}

function vaultKeyWrapAdditionalData(userId: string): Uint8Array {
  return textEncoder.encode(`ficonter:vault-key:${userId}:v1`);
}

async function deriveRecoveryWrappingKey(
  recoverySecret: Uint8Array,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const cryptoApi = requireWebCrypto();
  const keyMaterial = await cryptoApi.subtle.importKey(
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
      info: toArrayBuffer(textEncoder.encode("ficonter:vault-recovery-wrap:v1")),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function importVaultKey(rawKey: Uint8Array): Promise<CryptoKey> {
  if (rawKey.length !== 32) throw new Error("Recovered vault key is invalid.");
  return requireWebCrypto().subtle.importKey(
    "raw",
    toArrayBuffer(rawKey),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function assertEnvelope(envelope: WrappedVaultKeyEnvelopeV1) {
  if (
    envelope.v !== 1 ||
    envelope.alg !== "A256GCM" ||
    envelope.kdf !== "HKDF-SHA256"
  ) {
    throw new Error("Unsupported FICONTER vault format.");
  }
}

export async function rotateRecoveryCodeForSameVaultKey({
  userId,
  currentRecoveryCode,
  envelope,
}: {
  userId: string;
  currentRecoveryCode: string;
  envelope: WrappedVaultKeyEnvelopeV1;
}): Promise<RotatedRecoveryMaterial> {
  if (!userId) throw new Error("User ID is required.");
  assertEnvelope(envelope);

  const cryptoApi = requireWebCrypto();
  const currentSecret = recoveryCodeToBytes(currentRecoveryCode);
  const currentSalt = base64UrlToBytes(envelope.salt);
  const currentIv = base64UrlToBytes(envelope.iv);
  const currentCiphertext = base64UrlToBytes(envelope.ct);

  let rawVaultKey: Uint8Array | null = null;
  let replacementSecret: Uint8Array | null = null;

  try {
    const currentWrappingKey = await deriveRecoveryWrappingKey(
      currentSecret,
      currentSalt,
    );

    let decrypted: ArrayBuffer;
    try {
      decrypted = await cryptoApi.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: toArrayBuffer(currentIv),
          additionalData: toArrayBuffer(vaultKeyWrapAdditionalData(userId)),
        },
        currentWrappingKey,
        toArrayBuffer(currentCiphertext),
      );
    } catch {
      throw new Error("The current recovery code is incorrect.");
    }

    rawVaultKey = new Uint8Array(decrypted);
    if (rawVaultKey.length !== 32) {
      throw new Error("Recovered vault key is invalid.");
    }

    const replacement = createRecoveryCode();
    replacementSecret = replacement.secretBytes;
    const replacementSalt = randomBytes(16);
    const replacementIv = randomBytes(12);

    const replacementWrappingKey = await deriveRecoveryWrappingKey(
      replacementSecret,
      replacementSalt,
    );

    const wrapped = await cryptoApi.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(replacementIv),
        additionalData: toArrayBuffer(vaultKeyWrapAdditionalData(userId)),
      },
      replacementWrappingKey,
      toArrayBuffer(rawVaultKey),
    );

    const vaultKey = await importVaultKey(rawVaultKey);

    return {
      vaultKey,
      recoveryCode: replacement.code,
      wrappedVaultKey: {
        v: 1,
        alg: "A256GCM",
        kdf: "HKDF-SHA256",
        salt: bytesToBase64Url(replacementSalt),
        iv: bytesToBase64Url(replacementIv),
        ct: bytesToBase64Url(new Uint8Array(wrapped)),
      },
    };
  } finally {
    currentSecret.fill(0);
    rawVaultKey?.fill(0);
    replacementSecret?.fill(0);
  }
}
