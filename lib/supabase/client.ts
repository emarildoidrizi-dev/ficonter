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
    // A cookie without Max-Age or Expires is a browser-session cookie.
    document.cookie =
      `${TRUST_COOKIE}=0; Path=/; SameSite=Lax${secure}`;
  }
}

/**
 * Keep the concrete Supabase return type intact.
 *
 * Taking ReturnType directly from the generic createBrowserClient function
 * widens parts of the realtime API and removes contextual typing from channel
 * callbacks. Inferring the type from this concrete wrapper preserves the
 * Postgres changes payload type used across the dashboard.
 */
function createConfiguredBrowserClient(
  url: string,
  key: string,
  keepSignedIn: boolean,
) {
  return createBrowserClient<Database>(url, key, {
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

/**
 * Returns one shared browser client per session-persistence mode.
 *
 * Several dashboard widgets mount together. Reusing the client prevents each
 * widget from creating duplicate auth listeners, refresh timers and realtime
 * transports while preserving the trusted-device cookie behaviour.
 *
 * The returned browser client also enforces the Bills E2EE write boundary:
 * once an encrypted Bill payload is present, readable private Bill fields are
 * replaced with NULL before the request leaves the browser.
 */
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

  const client = addBillCiphertextWriteBoundary(
    createConfiguredBrowserClient(url, key, keepSignedIn),
  );
  clientCache.set(keepSignedIn, client);
  return client;
}
