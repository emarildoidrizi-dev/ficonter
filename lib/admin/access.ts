import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AdminRole = "admin" | "super_admin";

const FALLBACK_SUPER_ADMIN_EMAIL = "wixlyydo@gmail.com";

export function getPrimarySuperAdminEmail(): string {
  return (
    process.env.FICONTER_SUPER_ADMIN_EMAIL?.trim().toLowerCase() ||
    FALLBACK_SUPER_ADMIN_EMAIL
  );
}

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

  const isPrimarySuperAdmin =
    user.email?.trim().toLowerCase() === getPrimarySuperAdminEmail();

  if (isPrimarySuperAdmin) {
    return {
      user,
      admin: {
        user_id: user.id,
        role: "super_admin" as const,
      },
    };
  }

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
