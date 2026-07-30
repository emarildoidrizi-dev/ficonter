import "server-only";

import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { createServiceClient } from "@/lib/supabase/admin";

export type AdminRole = "admin" | "super_admin";

const FALLBACK_SUPER_ADMIN_EMAIL = "wixlyydo@gmail.com";

export function getPrimarySuperAdminEmail(): string {
  return (
    process.env.FICONTER_SUPER_ADMIN_EMAIL?.trim().toLowerCase() ||
    FALLBACK_SUPER_ADMIN_EMAIL
  );
}

export function isPrimarySuperAdminEmail(
  email: string | null | undefined,
): boolean {
  return email?.trim().toLowerCase() === getPrimarySuperAdminEmail();
}

export const requireAdmin = cache(async () => {
  const { user, error: userError } = await getCurrentUser();

  if (userError || !user) {
    return { user: null, admin: null };
  }

  if (isPrimarySuperAdminEmail(user.email)) {
    return {
      user,
      admin: {
        user_id: user.id,
        role: "super_admin" as const,
      },
    };
  }

  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("admin_users")
      .select("user_id,role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Admin role verification failed", {
        userId: user.id,
        code: error.code,
      });
      return { user, admin: null };
    }

    return {
      user,
      admin: data as {
        user_id: string;
        role: AdminRole;
      } | null,
    };
  } catch (error) {
    console.error("Admin role verification could not initialize", {
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return { user, admin: null };
  }
});

export async function isProtectedSuperAdminAccount(
  userId: string,
  email: string | null | undefined,
): Promise<boolean> {
  if (isPrimarySuperAdminEmail(email)) return true;

  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("admin_users")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Super-admin protection check failed", {
        userId,
        code: error.code,
      });
      return true;
    }

    return data?.role === "super_admin";
  } catch (error) {
    console.error("Super-admin protection check could not initialize", {
      userId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return true;
  }
}
