const DB_NAME = "ficonter-vault-passkey-unlock";
const STORE_NAME = "keys";
const DB_VERSION = 1;
const STORAGE_PREFIX = "ficonter:vault-passkey-unlock:v1:";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type PasskeyUnlockEnvelope = {
  v: 1;
  iv: string;
  ct: string;
};

function browserAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof indexedDB !== "undefined" &&
    Boolean(globalThis.crypto?.subtle)
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function envelopeKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function aad(userId: string): Uint8Array {
  return encoder.encode(`ficonter:vault-passkey-unlock:${userId}:v1`);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Secure device storage could not be opened."));
  });
}

async function putKey(userId: string, key: CryptoKey): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(key, userId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Secure device key could not be stored."));
    });
  } finally {
    db.close();
  }
}

async function getKey(userId: string): Promise<CryptoKey | null> {
  const db = await openDb();
  try {
    return await new Promise<CryptoKey | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(userId);
      request.onsuccess = () => {
        const value = request.result;
        resolve(value instanceof CryptoKey ? value : null);
      };
      request.onerror = () => reject(request.error ?? new Error("Secure device key could not be read."));
    });
  } finally {
    db.close();
  }
}

async function deleteKey(userId: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(userId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Secure device key could not be removed."));
    });
  } finally {
    db.close();
  }
}

export function hasVaultPasskeyUnlock(userId: string): boolean {
  if (!browserAvailable() || !userId) return false;
  return Boolean(window.localStorage.getItem(envelopeKey(userId)));
}

export async function clearVaultPasskeyUnlock(userId: string): Promise<void> {
  if (!browserAvailable() || !userId) return;
  window.localStorage.removeItem(envelopeKey(userId));
  await deleteKey(userId).catch(() => undefined);
}

export async function saveVaultPasskeyUnlock(
  userId: string,
  recoveryCode: string,
): Promise<void> {
  if (!browserAvailable() || !userId) {
    throw new Error("Passkey vault unlock is unavailable on this device.");
  }
  if (!recoveryCode) throw new Error("Recovery code is required.");

  const cryptoApi = globalThis.crypto;
  const wrappingKey = await cryptoApi.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(recoveryCode);

  try {
    const ciphertext = await cryptoApi.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(aad(userId)),
      },
      wrappingKey,
      toArrayBuffer(plaintext),
    );

    await putKey(userId, wrappingKey);

    const envelope: PasskeyUnlockEnvelope = {
      v: 1,
      iv: toBase64(iv),
      ct: toBase64(new Uint8Array(ciphertext)),
    };

    window.localStorage.setItem(envelopeKey(userId), JSON.stringify(envelope));
  } finally {
    plaintext.fill(0);
  }
}

export async function recoverCodeWithVaultPasskey(userId: string): Promise<string> {
  if (!browserAvailable() || !userId) {
    throw new Error("Passkey vault unlock is unavailable on this device.");
  }

  const raw = window.localStorage.getItem(envelopeKey(userId));
  if (!raw) throw new Error("Passkey vault unlock is not configured on this device.");

  let envelope: PasskeyUnlockEnvelope;
  try {
    envelope = JSON.parse(raw) as PasskeyUnlockEnvelope;
  } catch {
    await clearVaultPasskeyUnlock(userId);
    throw new Error("Passkey vault unlock needs to be set up again.");
  }

  if (envelope.v !== 1 || !envelope.iv || !envelope.ct) {
    await clearVaultPasskeyUnlock(userId);
    throw new Error("Passkey vault unlock needs to be set up again.");
  }

  const wrappingKey = await getKey(userId);
  if (!wrappingKey || wrappingKey.extractable) {
    await clearVaultPasskeyUnlock(userId);
    throw new Error("Passkey vault unlock needs to be set up again.");
  }

  try {
    const decrypted = await globalThis.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(fromBase64(envelope.iv)),
        additionalData: toArrayBuffer(aad(userId)),
      },
      wrappingKey,
      toArrayBuffer(fromBase64(envelope.ct)),
    );

    return decoder.decode(new Uint8Array(decrypted));
  } catch {
    await clearVaultPasskeyUnlock(userId);
    throw new Error("Passkey vault unlock needs to be set up again.");
  }
}
