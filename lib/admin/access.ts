import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AdminRole = "admin" | "super_admin";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, admin: null };

  const service = createServiceClient();
  const { data: admin } = await service
    .from("admin_users")
    .select("user_id,role")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    user,
    admin: admin as { user_id: string; role: AdminRole } | null,
  };
}
