// FICONTER Assisted Recovery emergency envelope.
//
// SECURITY RULES:
// - The emergency envelope wraps the SAME 256-bit Vault key.
// - Wrapping happens only in the customer's browser.
// - Only the public recovery key is ever exposed to the browser.
// - The private recovery key must live behind a managed KMS/HSM boundary.
// - Supabase stores only the ciphertext envelope and metadata.
// - This module intentionally contains no private-key decryption path.

const textEncoder = new TextEncoder();

export type EmergencyRecoveryPublicKeyV1 = {
  kid: string;
  alg: "RSA-OAEP-256";
  jwk: JsonWebKey;
};

export type EmergencyRecoveryEnvelopeV1 = {
  v: 1;
  alg: "RSA-OAEP-256";
  kid: string;
  ct: string;
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

function recoveryLabel(userId: string): Uint8Array {
  return textEncoder.encode(`ficonter:assisted-recovery:${userId}:v1`);
}

function assertPublicKey(input: EmergencyRecoveryPublicKeyV1) {
  if (!input?.kid || input.alg !== "RSA-OAEP-256") {
    throw new Error("Unsupported FICONTER emergency recovery key.");
  }

  if (input.jwk.kty !== "RSA" || !input.jwk.n || !input.jwk.e) {
    throw new Error("Invalid FICONTER emergency recovery public key.");
  }

  if (input.jwk.d) {
    throw new Error("A private recovery key must never be exposed to the browser.");
  }
}

export async function createEmergencyRecoveryEnvelope({
  userId,
  rawVaultKey,
  publicKey,
}: {
  userId: string;
  rawVaultKey: Uint8Array;
  publicKey: EmergencyRecoveryPublicKeyV1;
}): Promise<EmergencyRecoveryEnvelopeV1> {
  if (!userId) throw new Error("User ID is required.");
  if (rawVaultKey.length !== 32) throw new Error("Invalid Vault key length.");

  assertPublicKey(publicKey);
  const cryptoApi = requireWebCrypto();

  const wrappingKey = await cryptoApi.subtle.importKey(
    "jwk",
    publicKey.jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["encrypt"],
  );

  const ciphertext = await cryptoApi.subtle.encrypt(
    {
      name: "RSA-OAEP",
      label: toArrayBuffer(recoveryLabel(userId)),
    },
    wrappingKey,
    toArrayBuffer(rawVaultKey),
  );

  return {
    v: 1,
    alg: "RSA-OAEP-256",
    kid: publicKey.kid,
    ct: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
}
