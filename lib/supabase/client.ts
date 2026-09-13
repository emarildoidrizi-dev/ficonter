import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.contract";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const TRUST_COOKIE = "ficonter_trusted_device";

const BILL_PRIVATE_FIELDS = [
  "name",
  "company",
  "category",
  "amount",
  "currency",
  "amount_eur",
  "exchange_rate_to_eur",
  "payment_method",
  "notes",
] as const;

function readTrustedDevicePreference(): boolean {
  if (typeof document === "undefined") return false;

  const cookies = document.cookie.split(";").map((part) => part.trim());
  return cookies.includes(`${TRUST_COOKIE}=1`);
}

export function saveTrustedDevicePreference(keepSignedIn: boolean): void {
  if (typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  if (keepSignedIn) {
    document.cookie =
      `${TRUST_COOKIE}=1; Path=/; Max-Age=${ONE_YEAR_SECONDS}; ` +
      `SameSite=Lax${secure}`;
  } else {
    document.cookie =
      `${TRUST_COOKIE}=0; Path=/; SameSite=Lax${secure}`;
  }
}

function createConfiguredBrowserClient(
  url: string,
  key: string,
  keepSignedIn: boolean,
) {
  return createBrowserClient<Database>(url, key, {
    auth: {
      experimental: {
        passkey: true,
      },
    },
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      ...(keepSignedIn ? { maxAge: ONE_YEAR_SECONDS } : {}),
    },
  });
}

type BrowserClient = ReturnType<typeof createConfiguredBrowserClient>;

const clientCache = new Map<boolean, BrowserClient>();

function sanitizeEncryptedBillValue(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  if (record.encryption_version !== 1 || !record.encrypted_payload) {
    return value;
  }

  const sanitized: Record<string, unknown> = { ...record };
  for (const field of BILL_PRIVATE_FIELDS) {
    sanitized[field] = null;
  }
  return sanitized;
}

function sanitizeEncryptedBillWrite(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map((item) => sanitizeEncryptedBillValue(item))
    : sanitizeEncryptedBillValue(value);
}

function addBillCiphertextWriteBoundary(client: BrowserClient): BrowserClient {
  const rawClient = client as BrowserClient & {
    from: (relation: string) => any;
    __ficonterBillBoundary?: boolean;
  };

  if (rawClient.__ficonterBillBoundary) return client;

  const originalFrom = rawClient.from.bind(client);
  rawClient.from = ((relation: string) => {
    const builder = originalFrom(relation);
    if (relation !== "bills") return builder;

    return new Proxy(builder, {
      get(target, property, receiver) {
        const original = Reflect.get(target, property, receiver);
        if (
          (property === "insert" ||
            property === "update" ||
            property === "upsert") &&
          typeof original === "function"
        ) {
          return (value: unknown, ...args: unknown[]) =>
            original.call(
              target,
              sanitizeEncryptedBillWrite(value),
              ...args,
            );
        }
        return typeof original === "function" ? original.bind(target) : original;
      },
    });
  }) as typeof rawClient.from;

  rawClient.__ficonterBillBoundary = true;
  return client;
}

function addOwnerBackupRestoreBoundary(client: BrowserClient): BrowserClient {
  const rawClient = client as BrowserClient & {
    rpc: (fn: string, args?: Record<string, unknown>, options?: unknown) => any;
    __ficonterOwnerBackupBoundary?: boolean;
  };

  if (rawClient.__ficonterOwnerBackupBoundary) return client;

  const originalRpc = rawClient.rpc.bind(client);
  rawClient.rpc = ((
    fn: string,
    args?: Record<string, unknown>,
    options?: unknown,
  ) => {
    if (fn !== "restore_portable_backup_v2") {
      return originalRpc(fn, args, options);
    }

    return (async () => {
      const response = await fetch("/api/owner/backup/authorize-restore", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: "{}",
      });

      const authorizationResult = (await response.json().catch(() => null)) as
        | { authorization?: string; error?: string }
        | null;

      if (!response.ok || !authorizationResult?.authorization) {
        throw new Error(
          authorizationResult?.error ??
            "Only the FICONTER Owner can authorize backup restore.",
        );
      }

      return originalRpc(
        "restore_portable_backup_v2_owner",
        {
          p_payload: args?.p_payload ?? null,
          p_authorization: authorizationResult.authorization,
        },
        options,
      );
    })();
  }) as typeof rawClient.rpc;

  rawClient.__ficonterOwnerBackupBoundary = true;
  return client;
}

export function createClient(keepSignedInOverride?: boolean): BrowserClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  const keepSignedIn =
    keepSignedInOverride ?? readTrustedDevicePreference();

  const cached = clientCache.get(keepSignedIn);
  if (cached) return cached;

  const client = addOwnerBackupRestoreBoundary(
    addBillCiphertextWriteBoundary(
      createConfiguredBrowserClient(url, key, keepSignedIn),
    ),
  );
  clientCache.set(keepSignedIn, client);
  return client;
}
