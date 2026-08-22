import { decryptVaultPayload, encryptVaultPayload, type VaultCiphertextEnvelopeV1 } from "@/lib/e2ee/vault";

type PrivateKeyEnvelopeV1 = VaultCiphertextEnvelopeV1;

export type BusinessWrappedKeyEnvelopeV1 = {
  v: 1;
  alg: "RSA-OAEP-256";
  ct: string;
};

export type BusinessCiphertextEnvelopeV1 = {
  v: 1;
  alg: "A256GCM";
  iv: string;
  ct: string;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function requireCrypto() {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto API is not available.");
  return globalThis.crypto;
}

export async function createBusinessSharingKeyPair(
  personalVaultKey: CryptoKey,
  userId: string,
): Promise<{ publicKeyJwk: JsonWebKey; encryptedPrivateKey: PrivateKeyEnvelopeV1 }> {
  const cryptoApi = requireCrypto();
  const pair = await cryptoApi.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const publicKeyJwk = await cryptoApi.subtle.exportKey("jwk", pair.publicKey);
  const privateKeyPkcs8 = new Uint8Array(await cryptoApi.subtle.exportKey("pkcs8", pair.privateKey));
  try {
    const encryptedPrivateKey = await encryptVaultPayload(
      personalVaultKey,
      userId,
      "business-sharing-private-key",
      userId,
      { pkcs8: bytesToBase64Url(privateKeyPkcs8) },
    );
    return { publicKeyJwk, encryptedPrivateKey };
  } finally {
    privateKeyPkcs8.fill(0);
  }
}

export async function openBusinessSharingPrivateKey(
  personalVaultKey: CryptoKey,
  userId: string,
  envelope: PrivateKeyEnvelopeV1,
): Promise<CryptoKey> {
  const payload = await decryptVaultPayload(
    personalVaultKey,
    userId,
    "business-sharing-private-key",
    userId,
    envelope,
  );
  const encoded = typeof payload.pkcs8 === "string" ? payload.pkcs8 : "";
  if (!encoded) throw new Error("Business sharing private key is unavailable.");
  const bytes = base64UrlToBytes(encoded);
  try {
    return await requireCrypto().subtle.importKey(
      "pkcs8",
      toArrayBuffer(bytes),
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"],
    );
  } finally {
    bytes.fill(0);
  }
}

export async function createBusinessVaultKey(): Promise<CryptoKey> {
  return requireCrypto().subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function wrapBusinessVaultKey(
  businessKey: CryptoKey,
  publicKeyJwk: JsonWebKey,
): Promise<BusinessWrappedKeyEnvelopeV1> {
  const cryptoApi = requireCrypto();
  const publicKey = await cryptoApi.subtle.importKey(
    "jwk",
    publicKeyJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const raw = new Uint8Array(await cryptoApi.subtle.exportKey("raw", businessKey));
  try {
    const ciphertext = new Uint8Array(
      await cryptoApi.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, toArrayBuffer(raw)),
    );
    return { v: 1, alg: "RSA-OAEP-256", ct: bytesToBase64Url(ciphertext) };
  } finally {
    raw.fill(0);
  }
}

export async function unwrapBusinessVaultKey(
  privateKey: CryptoKey,
  envelope: BusinessWrappedKeyEnvelopeV1,
): Promise<CryptoKey> {
  if (envelope.v !== 1 || envelope.alg !== "RSA-OAEP-256" || !envelope.ct) {
    throw new Error("Unsupported wrapped business key format.");
  }
  const ciphertext = base64UrlToBytes(envelope.ct);
  const raw = new Uint8Array(
    await requireCrypto().subtle.decrypt({ name: "RSA-OAEP" }, privateKey, toArrayBuffer(ciphertext)),
  );
  try {
    if (raw.length !== 32) throw new Error("Invalid business vault key.");
    return await requireCrypto().subtle.importKey(
      "raw",
      toArrayBuffer(raw),
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } finally {
    raw.fill(0);
  }
}

function businessAdditionalData(
  businessId: string,
  recordType: string,
  recordId: string,
): Uint8Array {
  return new TextEncoder().encode(
    `ficonter:business:${businessId}:${recordType}:${recordId}:v1`,
  );
}

export async function encryptBusinessPayload(
  businessKey: CryptoKey,
  businessId: string,
  recordType: string,
  recordId: string,
  payload: Record<string, unknown>,
): Promise<BusinessCiphertextEnvelopeV1> {
  const cryptoApi = requireCrypto();
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  try {
    const encrypted = new Uint8Array(
      await cryptoApi.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: toArrayBuffer(iv),
          additionalData: toArrayBuffer(businessAdditionalData(businessId, recordType, recordId)),
        },
        businessKey,
        toArrayBuffer(plaintext),
      ),
    );
    return {
      v: 1,
      alg: "A256GCM",
      iv: bytesToBase64Url(iv),
      ct: bytesToBase64Url(encrypted),
    };
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptBusinessPayload(
  businessKey: CryptoKey,
  businessId: string,
  recordType: string,
  recordId: string,
  envelope: BusinessCiphertextEnvelopeV1,
): Promise<Record<string, unknown>> {
  if (envelope.v !== 1 || envelope.alg !== "A256GCM") {
    throw new Error("Unsupported encrypted business payload format.");
  }
  const decrypted = new Uint8Array(
    await requireCrypto().subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(base64UrlToBytes(envelope.iv)),
        additionalData: toArrayBuffer(businessAdditionalData(businessId, recordType, recordId)),
      },
      businessKey,
      toArrayBuffer(base64UrlToBytes(envelope.ct)),
    ),
  );
  try {
    return JSON.parse(new TextDecoder().decode(decrypted)) as Record<string, unknown>;
  } finally {
    decrypted.fill(0);
  }
}
