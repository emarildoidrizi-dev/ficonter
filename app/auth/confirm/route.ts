import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeAuthEntry, withAuthEntry } from "@/lib/auth/recovery";
import type { EmailOtpType } from "@supabase/supabase-js";

function safeNextPath(value: string | null, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

function publicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

function recoveryFailurePath(next: string, error: "invalid_link" | "expired_link") {
  const nextUrl = new URL(next, "https://ficonter.invalid");
  const entry = normalizeAuthEntry(nextUrl.searchParams.get("entry"));
  return withAuthEntry(`/recover-account?mode=password&error=${error}`, entry);
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const fallback = type === "recovery" ? "/update-password" : "/dashboard";
  const next = safeNextPath(request.nextUrl.searchParams.get("next"), fallback);
  const origin = publicOrigin(request);

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL(recoveryFailurePath(next, "invalid_link"), origin),
    );
  }

  // A password-recovery token is single use. Never verify it from an email GET:
  // security scanners can prefetch links before the user clicks them. Route
  // recovery links to a FICONTER confirmation page and consume the token only
  // after an explicit POST from the user.
  if (type === "recovery") {
    const recoveryUrl = new URL("/auth/recovery", origin);
    recoveryUrl.searchParams.set("token_hash", tokenHash);
    recoveryUrl.searchParams.set("type", "recovery");
    recoveryUrl.searchParams.set("next", next);
    return NextResponse.redirect(recoveryUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(
      new URL(recoveryFailurePath(next, "expired_link"), origin),
    );
  }

  return NextResponse.redirect(new URL(next, origin));
}
