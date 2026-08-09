import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/access";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const BETA_FREE_SESSION_COOKIE = "ficonter_beta_free_session";

export async function POST(request: NextRequest) {
  const responseHeaders = noStoreHeaders();

  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403, headers: responseHeaders },
    );
  }

  const { user, error: userError } = await getCurrentUser();
  if (userError || !user) {
    return NextResponse.json(
      { error: "Sign in before continuing." },
      { status: 401, headers: responseHeaders },
    );
  }

  const { admin } = await requireAdmin();

  if (!admin) {
    const service = createServiceClient() as any;
    const { data: subscription } = await service
      .from("subscriptions")
      .select("plan_code")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscription?.plan_code === "beta") {
      const { data: entitlement } = await service
        .from("beta_user_entitlements")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!entitlement) {
        await service
          .from("subscriptions")
          .update({
            plan_code: "free",
            status: "active",
            billing_interval: null,
            provider: "internal",
            current_period_start: null,
            current_period_end: null,
            cancel_at_period_end: false,
          })
          .eq("user_id", user.id);
      }
    }
  }

  const response = NextResponse.json(
    { ok: true },
    { status: 200, headers: responseHeaders },
  );

  response.cookies.set(BETA_FREE_SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}
