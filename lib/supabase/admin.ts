import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

function readAdminKey(): string {
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (publicKey && key === publicKey) {
    throw new Error("The Supabase admin key cannot be the public anon key.");
  }

  if (key.startsWith("sb_publishable_")) {
    throw new Error("A publishable Supabase key cannot be used for admin tasks.");
  }

  return key;
}

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  return createSupabaseClient<Database>(url, readAdminKey(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "ficonter-server-admin",
      },
    },
  });
}
