import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/access";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { BETA_FREE_COOKIE, BETA_LOGIN_COOKIE } from "@/lib/betaDomainGate";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BETA_LOGIN_TTL_SECONDS = 12 * 60 * 60;

function hashValue(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function constantTimeHexEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(left, "hex"),
      Buffer.from(right, "hex"),
    );
  } catch {
    return false;
  }
}

function clearBetaLoginCookie(response: NextResponse) {
  response.cookies.set(BETA_LOGIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function clearBetaFreeCookie(response: NextResponse) {
  response.cookies.set(BETA_FREE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function DELETE(request: NextRequest) {
  const headers = noStoreHeaders();

  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403, headers },
    );
  }

  const response = NextResponse.json({ ok: true }, { status: 200, headers });
  clearBetaLoginCookie(response);
  clearBetaFreeCookie(response);
  return response;
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
      { error: "Sign in before entering the Beta platform." },
      { status: 401, headers },
    );
  }

  // Owner / Super Admin / Admin are NOT customer subscriptions.
  // They bypass Beta code, payment and plan gates entirely.
  const { admin } = await requireAdmin();
  if (admin) {
    return NextResponse.json(
      { ok: true, adminExempt: true },
      { status: 200, headers },
    );
  }

  let payload: { code?: unknown };

  try {
    payload = (await request.json()) as { code?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Enter the Beta invitation code." },
      { status: 400, headers },
    );
  }

  const code = typeof payload.code === "string" ? payload.code.trim() : "";

  if (!code || code.length > 160) {
    return NextResponse.json(
      {
        error:
          "A valid Beta invitation code is required to sign in at this Beta address.",
      },
      { status: 403, headers },
    );
  }

  const service = createServiceClient();
  const codeHash = hashValue(code);

  // The submitted code itself must be a currently active invitation.
  const { data: invite, error: inviteError } = await service
    .from("beta_invite_codes")
    .select("id,code_hash,active,expires_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (
    inviteError ||
    !invite ||
    invite.active !== true ||
    !constantTimeHexEqual(codeHash, String(invite.code_hash ?? "")) ||
    (invite.expires_at && Date.parse(invite.expires_at) <= Date.now())
  ) {
    return NextResponse.json(
      { error: "The Beta invitation code is invalid or no longer active." },
      { status: 403, headers },
    );
  }

  const [{ data: subscription }, { data: entitlement }] = await Promise.all([
    service
      .from("subscriptions")
      .select("plan_code,status,provider,current_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
    service
      .from("beta_user_entitlements")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const alreadyVerifiedBeta =
    subscription?.plan_code === "beta" && Boolean(entitlement);

  if (!alreadyVerifiedBeta) {
    const { data: activated, error: activationError } = await service.rpc(
      "activate_ficonter_beta_for_existing_user",
      {
        p_user_id: user.id,
        p_code_hash: codeHash,
      },
    );

    if (activationError) {
      const message = String(activationError.message ?? "");

      if (message.includes("ACTIVE_PAID_SUBSCRIPTION")) {
        return NextResponse.json(
          {
            error:
              "This customer currently has active paid PayPal access. Finish or cancel that paid period before converting this account to private Beta.",
          },
          { status: 409, headers },
        );
      }

      console.error("Beta login activation failed", {
        userId: user.id,
        code: activationError.code,
      });

      return NextResponse.json(
        { error: "Beta access could not be activated. Please try again." },
        { status: 500, headers },
      );
    }

    if (activated !== true) {
      return NextResponse.json(
        { error: "The Beta invitation code is invalid or unavailable." },
        { status: 403, headers },
      );
    }
  }

  // Create an opaque, server-verified Beta login session. The dashboard gate
  // checks the database copy, so a browser-created cookie cannot bypass it.
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashValue(rawToken);
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
    console.error("Beta login session creation failed", {
      userId: user.id,
      code: sessionError.code,
    });

    return NextResponse.json(
      { error: "Beta session could not be created. Please try again." },
      { status: 500, headers },
    );
  }

  const response = NextResponse.json(
    { ok: true, planCode: "beta" },
    { status: 200, headers },
  );

  // A verified Beta choice replaces any prior explicit Free-session choice.
  clearBetaFreeCookie(response);

  response.cookies.set(BETA_LOGIN_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BETA_LOGIN_TTL_SECONDS,
  });

  return response;
}
