import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/access";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { BETA_FREE_COOKIE, BETA_LOGIN_COOKIE } from "@/lib/betaDomainGate";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BETA_LOGIN_TTL_SECONDS = 12 * 60 * 60;

function hashCode(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function clearFreeSession(response: NextResponse) {
  response.cookies.set(BETA_FREE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function POST(request: NextRequest) {
  const headers = noStoreHeaders();

  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403, headers },
    );
  }

  const { user, error: userError } = await getCurrentUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Sign in before activating Beta access." },
      { status: 401, headers },
    );
  }

  // Owner / Super Admin / Admin are permanently subscription-exempt.
  const { admin } = await requireAdmin();
  if (admin) {
    return NextResponse.json(
      { error: "Administrative accounts already have full platform access." },
      { status: 409, headers },
    );
  }

  let payload: { code?: unknown };

  try {
    payload = (await request.json()) as { code?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400, headers },
    );
  }

  const code = typeof payload.code === "string" ? payload.code.trim() : "";

  if (!code || code.length > 160) {
    return NextResponse.json(
      { error: "Enter a valid Beta invitation code." },
      { status: 403, headers },
    );
  }

  const service = createServiceClient();
  const { data, error } = await service.rpc(
    "activate_ficonter_beta_for_existing_user",
    {
      p_user_id: user.id,
      p_code_hash: hashCode(code),
    },
  );

  if (error) {
    const message = String(error.message ?? "");

    if (message.includes("ACTIVE_PAID_SUBSCRIPTION")) {
      return NextResponse.json(
        {
          error:
            "Your paid PayPal access is still active. Finish or cancel that paid period before switching this account to private Beta, so billing is not left running in the background.",
        },
        { status: 409, headers },
      );
    }

    console.error("Existing-account Beta activation failed", {
      userId: user.id,
      code: error.code,
    });

    return NextResponse.json(
      { error: "Beta access could not be activated. Please try again." },
      { status: 500, headers },
    );
  }

  if (data !== true) {
    return NextResponse.json(
      { error: "The Beta invitation code is invalid or no longer available." },
      { status: 403, headers },
    );
  }

  // IMPORTANT: switching from Free-session mode to verified Beta must update
  // the browser session as well as the database. Otherwise the old Free cookie
  // continues to override the newly activated Beta entitlement after reload.
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashCode(rawToken);
  const expiresAt = new Date(
    Date.now() + BETA_LOGIN_TTL_SECONDS * 1000,
  ).toISOString();

  await service
    .from("beta_login_sessions")
    .delete()
    .eq("user_id", user.id)
    .lt("expires_at", new Date().toISOString());

  const { error: sessionError } = await service
    .from("beta_login_sessions")
    .insert({
      token_hash: tokenHash,
      user_id: user.id,
      expires_at: expiresAt,
    });

  if (sessionError) {
    console.error("Existing-account Beta session creation failed", {
      userId: user.id,
      code: sessionError.code,
    });

    return NextResponse.json(
      {
        error:
          "Beta access was activated, but this browser session could not enter Beta. Please try again.",
      },
      { status: 500, headers },
    );
  }

  const response = NextResponse.json(
    { ok: true, planCode: "beta" },
    { status: 200, headers },
  );

  // Beta activation explicitly replaces any previous "Continue with Free" choice.
  clearFreeSession(response);

  response.cookies.set(BETA_LOGIN_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BETA_LOGIN_TTL_SECONDS,
  });

  return response;
}
