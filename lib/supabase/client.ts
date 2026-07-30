import { createBrowserClient } from "@supabase/ssr";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const TRUST_COOKIE = "ficonter_trusted_device";

type BrowserClient = ReturnType<typeof createBrowserClient>;

const clientCache = new Map<boolean, BrowserClient>();

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
 * Returns one shared browser client per session-persistence mode.
 *
 * Several dashboard widgets mount together. Reusing the client prevents each
 * widget from creating its own auth listeners, refresh timers and realtime
 * transport while preserving the trusted-device cookie behaviour.
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

  const client = createBrowserClient(url, key, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      ...(keepSignedIn ? { maxAge: ONE_YEAR_SECONDS } : {}),
    },
  });

  clientCache.set(keepSignedIn, client);
  return client;
}
