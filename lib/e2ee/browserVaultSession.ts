const DB_NAME = "ficonter-vault-session";
const STORE_NAME = "keys";
const DB_VERSION = 1;
const SESSION_MARKER = "ficonter:vault-session:v1";

type SessionMarker = {
  v: 1;
  userId: string;
  sessionId: string;
};

function browserAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof indexedDB !== "undefined"
  );
}

function readMarker(): SessionMarker | null {
  if (typeof window === "undefined") return null;

  try {
    const raw =
      window.sessionStorage.getItem(SESSION_MARKER);
    if (!raw) return null;

    const parsed =
      JSON.parse(raw) as Partial<SessionMarker>;

    if (
      parsed.v !== 1 ||
      typeof parsed.userId !== "string" ||
      !parsed.userId ||
      typeof parsed.sessionId !== "string" ||
      !parsed.sessionId
    ) {
      window.sessionStorage.removeItem(
        SESSION_MARKER,
      );
      return null;
    }

    return parsed as SessionMarker;
  } catch {
    return null;
  }
}

function writeMarker(marker: SessionMarker): void {
  window.sessionStorage.setItem(
    SESSION_MARKER,
    JSON.stringify(marker),
  );
}

function storageKey(marker: SessionMarker): string {
  return `${marker.userId}:${marker.sessionId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request =
      indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (
        !db.objectStoreNames.contains(STORE_NAME)
      ) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () =>
      resolve(request.result);

    request.onerror = () =>
      reject(
        request.error ??
          new Error(
            "Vault session database could not be opened.",
          ),
      );
  });
}

function looksLikeCryptoKey(
  value: unknown,
): value is CryptoKey {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate =
    value as Partial<CryptoKey>;

  return (
    typeof candidate.extractable === "boolean" &&
    typeof candidate.type === "string" &&
    candidate.algorithm != null &&
    Array.isArray(candidate.usages)
  );
}

async function putKey(
  id: string,
  key: CryptoKey,
): Promise<void> {
  const db = await openDb();

  try {
    await new Promise<void>(
      (resolve, reject) => {
        const tx =
          db.transaction(
            STORE_NAME,
            "readwrite",
          );

        tx.objectStore(STORE_NAME).put(
          key,
          id,
        );

        tx.oncomplete = () => resolve();

        tx.onerror = () =>
          reject(
            tx.error ??
              new Error(
                "Vault session key could not be stored.",
              ),
          );
      },
    );
  } finally {
    db.close();
  }
}

async function getKey(
  id: string,
): Promise<CryptoKey | null> {
  const db = await openDb();

  try {
    return await new Promise<CryptoKey | null>(
      (resolve, reject) => {
        const tx =
          db.transaction(
            STORE_NAME,
            "readonly",
          );

        const request =
          tx.objectStore(STORE_NAME).get(id);

        request.onsuccess = () => {
          const value =
            request.result as unknown;

          resolve(
            looksLikeCryptoKey(value)
              ? value
              : null,
          );
        };

        request.onerror = () =>
          reject(
            request.error ??
              new Error(
                "Vault session key could not be restored.",
              ),
          );
      },
    );
  } finally {
    db.close();
  }
}

async function deleteKey(
  id: string,
): Promise<void> {
  const db = await openDb();

  try {
    await new Promise<void>(
      (resolve, reject) => {
        const tx =
          db.transaction(
            STORE_NAME,
            "readwrite",
          );

        tx.objectStore(STORE_NAME).delete(id);

        tx.oncomplete = () => resolve();

        tx.onerror = () =>
          reject(
            tx.error ??
              new Error(
                "Vault session key could not be deleted.",
              ),
          );
      },
    );
  } finally {
    db.close();
  }
}

/**
 * Persists only the browser-native, non-extractable CryptoKey.
 * No recovery code or exported raw key is written to storage.
 *
 * A random session id in sessionStorage controls whether this
 * tab is allowed to restore the IndexedDB key after a reload.
 */
export async function rememberVaultKeyForBrowserSession(
  userId: string,
  vaultKey: CryptoKey,
): Promise<void> {
  if (!browserAvailable() || !userId) return;

  try {
    if (vaultKey.extractable) return;

    const previous = readMarker();

    if (
      previous &&
      previous.userId !== userId
    ) {
      await deleteKey(
        storageKey(previous),
      ).catch(() => undefined);
    }

    const marker: SessionMarker =
      previous?.userId === userId
        ? previous
        : {
            v: 1,
            userId,
            sessionId:
              crypto.randomUUID(),
          };

    await putKey(
      storageKey(marker),
      vaultKey,
    );

    writeMarker(marker);
  } catch {
    // Session persistence is an enhancement.
    // A browser that cannot clone/store CryptoKey must
    // still be allowed to unlock the vault normally.
  }
}

export async function restoreVaultKeyForBrowserSession(
  userId: string,
): Promise<CryptoKey | null> {
  if (!browserAvailable() || !userId) {
    return null;
  }

  try {
    const marker = readMarker();

    // No marker means this is not an authorized restore
    // for the current browser tab/session.
    if (!marker) return null;

    if (marker.userId !== userId) {
      await deleteKey(
        storageKey(marker),
      ).catch(() => undefined);

      window.sessionStorage.removeItem(
        SESSION_MARKER,
      );

      return null;
    }

    const key =
      await getKey(storageKey(marker));

    if (!key || key.extractable) {
      await deleteKey(
        storageKey(marker),
      ).catch(() => undefined);

      window.sessionStorage.removeItem(
        SESSION_MARKER,
      );

      return null;
    }

    return key;
  } catch {
    return null;
  }
}

export async function forgetVaultBrowserSession():
  Promise<void> {
  if (!browserAvailable()) return;

  try {
    const marker = readMarker();

    window.sessionStorage.removeItem(
      SESSION_MARKER,
    );

    if (marker) {
      await deleteKey(
        storageKey(marker),
      ).catch(() => undefined);
    }
  } catch {
    // The in-memory key is cleared separately by VaultProvider.
  }
}
