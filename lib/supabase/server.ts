import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.contract";
import { cookies } from "next/headers";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const TRUST_COOKIE = "ficonter_trusted_device";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  const keepSignedIn =
    cookieStore.get(TRUST_COOKIE)?.value === "1";

  return createServerClient<Database>(url, key, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      ...(keepSignedIn ? { maxAge: ONE_YEAR_SECONDS } : {}),
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            const finalOptions = {
              ...options,
              path: "/",
              sameSite: "lax" as const,
              secure: process.env.NODE_ENV === "production",
              ...(keepSignedIn
                ? { maxAge: ONE_YEAR_SECONDS }
                : { maxAge: undefined, expires: undefined }),
            };

            cookieStore.set(name, value, finalOptions);
          });
        } catch {
          // Server Components cannot always write cookies.
          // The proxy refreshes and writes the session when needed.
        }
      },
    },
  });
}
