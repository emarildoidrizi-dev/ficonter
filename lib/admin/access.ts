import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AdminRole = "admin" | "super_admin";

const PRIMARY_SUPER_ADMIN_EMAIL = "wixlyydo@gmail.com";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createAdminClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, admin: null };
  }

  // The founder account remains a deterministic super-admin even if an
  // admin_users lookup is temporarily unavailable. This check runs only on
  // the server against the verified Supabase Auth user email.
  if (
    user.email?.trim().toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL
  ) {
    return {
      user,
      admin: {
        user_id: user.id,
        role: "super_admin" as const,
      },
    };
  }

  // First use the authenticated client. The admin_users RLS policy permits
  // every admin to read their own role.
  const { data: authenticatedAdmin } = await supabase
    .from("admin_users")
    .select("user_id,role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (authenticatedAdmin) {
    return {
      user,
      admin: authenticatedAdmin as {
        user_id: string;
        role: AdminRole;
      },
    };
  }

  // Server-only fallback for non-founder administrators.
  const service = createServiceClient();
  const { data: serviceAdmin } = await service
    .from("admin_users")
    .select("user_id,role")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    user,
    admin: serviceAdmin as {
      user_id: string;
      role: AdminRole;
    } | null,
  };
}
