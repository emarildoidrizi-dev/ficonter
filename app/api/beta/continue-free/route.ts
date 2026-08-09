import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { BETA_FREE_COOKIE, BETA_LOGIN_COOKIE } from "@/lib/betaDomainGate";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const headers = noStoreHeaders();

  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403, headers },
    );
  }

  const { user, error } = await getCurrentUser();
  if (error || !user) {
    return NextResponse.json(
      { error: "Sign in before continuing with the Free plan." },
      { status: 401, headers },
    );
  }

  const response = NextResponse.json(
    { ok: true, planCode: "free" },
    { status: 200, headers },
  );

  // Explicitly leave Beta mode for this browser session. This does not mutate
  // PayPal billing or permanently rewrite an existing paid subscription.
  response.cookies.set(BETA_LOGIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set(BETA_FREE_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });

  return response;
}
