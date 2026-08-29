const STORAGE_PREFIX = "ficonter:vault-quick-unlock:v1:";
const PBKDF2_ITERATIONS = 600_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type QuickUnlockEnvelope = {
  v: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ct: string;
};

function requireCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure quick unlock is not supported on this device.");
  }
  return globalThis.crypto;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function validatePin(pin: string): void {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("Your FICONTER PIN must contain exactly 6 digits.");
  }
}

async function derivePinKey(pin: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const cryptoApi = requireCrypto();
  const material = await cryptoApi.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return cryptoApi.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function hasVaultQuickUnlock(userId: string): boolean {
  if (typeof window === "undefined" || !userId) return false;
  return Boolean(window.localStorage.getItem(storageKey(userId)));
}

export function clearVaultQuickUnlock(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.removeItem(storageKey(userId));
}

export async function saveVaultQuickUnlock(
  userId: string,
  pin: string,
  recoveryCode: string,
): Promise<void> {
  if (typeof window === "undefined" || !userId) {
    throw new Error("Quick unlock can only be enabled on this device.");
  }
  validatePin(pin);
  if (!recoveryCode) throw new Error("Recovery code is required.");

  const cryptoApi = requireCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await derivePinKey(pin, salt, PBKDF2_ITERATIONS);
  const plaintext = encoder.encode(recoveryCode);

  try {
    const encrypted = await cryptoApi.subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(plaintext),
    );

    const envelope: QuickUnlockEnvelope = {
      v: 1,
      kdf: "PBKDF2-SHA256",
      iterations: PBKDF2_ITERATIONS,
      salt: toBase64(salt),
      iv: toBase64(iv),
      ct: toBase64(new Uint8Array(encrypted)),
    };

    window.localStorage.setItem(storageKey(userId), JSON.stringify(envelope));
  } finally {
    plaintext.fill(0);
  }
}

export async function recoverCodeWithVaultPin(
  userId: string,
  pin: string,
): Promise<string> {
  if (typeof window === "undefined" || !userId) {
    throw new Error("Quick unlock is unavailable on this device.");
  }
  validatePin(pin);

  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) throw new Error("Quick unlock is not configured on this device.");

  let envelope: QuickUnlockEnvelope;
  try {
    envelope = JSON.parse(raw) as QuickUnlockEnvelope;
  } catch {
    clearVaultQuickUnlock(userId);
    throw new Error("Quick unlock needs to be set up again.");
  }

  if (
    envelope.v !== 1 ||
    envelope.kdf !== "PBKDF2-SHA256" ||
    !Number.isFinite(envelope.iterations) ||
    envelope.iterations < 100_000
  ) {
    clearVaultQuickUnlock(userId);
    throw new Error("Quick unlock needs to be set up again.");
  }

  try {
    const salt = fromBase64(envelope.salt);
    const iv = fromBase64(envelope.iv);
    const ciphertext = fromBase64(envelope.ct);
    const key = await derivePinKey(pin, salt, envelope.iterations);
    const decrypted = await requireCrypto().subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext),
    );
    return decoder.decode(new Uint8Array(decrypted));
  } catch {
    throw new Error("Incorrect PIN.");
  }
}
