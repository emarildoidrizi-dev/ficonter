import { createBrowserClient } from "@supabase/ssr";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const TRUST_COOKIE = "ficonter_trusted_device";

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

export function createClient(keepSignedInOverride?: boolean) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  const keepSignedIn =
    keepSignedInOverride ?? readTrustedDevicePreference();

  return createBrowserClient(url, key, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      ...(keepSignedIn ? { maxAge: ONE_YEAR_SECONDS } : {}),
    },
  });
}
