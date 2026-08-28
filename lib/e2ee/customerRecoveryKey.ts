// FICONTER customer-bound Assisted Recovery key.
//
// The private key is generated in and remains in the customer's browser.
// Only the public JWK may be sent to the recovery control plane.

export type CustomerRecoveryEphemeralKeyV1 = {
  alg: "RSA-OAEP-256";
  publicJwk: JsonWebKey;
  privateKey: CryptoKey;
};

export type CustomerWrappedVaultKeyV1 = {
  v: 1;
  alg: "RSA-OAEP-256";
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

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function customerRecoveryLabel(userId: string, recoveryAccessId: string): Uint8Array {
  return new TextEncoder().encode(
    `ficonter:customer-recovery:${userId}:${recoveryAccessId}:v1`,
  );
}

export async function createCustomerRecoveryEphemeralKey(): Promise<CustomerRecoveryEphemeralKeyV1> {
  const cryptoApi = requireWebCrypto();
  const pair = await cryptoApi.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 3072,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const publicJwk = await cryptoApi.subtle.exportKey("jwk", pair.publicKey);
  if (!publicJwk.n || !publicJwk.e || publicJwk.d) {
    throw new Error("Could not create a valid customer recovery public key.");
  }

  return {
    alg: "RSA-OAEP-256",
    publicJwk,
    privateKey: pair.privateKey,
  };
}

export async function unwrapCustomerRecoveryVaultKey({
  userId,
  recoveryAccessId,
  privateKey,
  wrapped,
}: {
  userId: string;
  recoveryAccessId: string;
  privateKey: CryptoKey;
  wrapped: CustomerWrappedVaultKeyV1;
}): Promise<Uint8Array> {
  if (!userId || !recoveryAccessId) {
    throw new Error("Recovery context is required.");
  }
  if (wrapped.v !== 1 || wrapped.alg !== "RSA-OAEP-256" || !wrapped.ct) {
    throw new Error("Unsupported customer recovery material.");
  }

  const ciphertext = base64UrlToBytes(wrapped.ct);
  const decrypted = await requireWebCrypto().subtle.decrypt(
    {
      name: "RSA-OAEP",
      label: toArrayBuffer(customerRecoveryLabel(userId, recoveryAccessId)),
    },
    privateKey,
    toArrayBuffer(ciphertext),
  );

  const rawVaultKey = new Uint8Array(decrypted);
  if (rawVaultKey.length !== 32) {
    rawVaultKey.fill(0);
    throw new Error("Recovered Vault key is invalid.");
  }
  return rawVaultKey;
}
