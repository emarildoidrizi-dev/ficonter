import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeAuthEntry, withAuthEntry } from "@/lib/auth/recovery";

function safeNextPath(value: string | null, fallback = "/dashboard"): string {
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

function isEmailChangeReturn(next: string): boolean {
  const nextUrl = new URL(next, "https://ficonter.invalid");
  return (
    nextUrl.pathname === "/dashboard/settings" &&
    nextUrl.searchParams.get("section") === "profile"
  );
}

function emailChangeReturnPath(next: string, status: "confirmed" | "error") {
  const nextUrl = new URL(next, "https://ficonter.invalid");
  nextUrl.searchParams.set("email_change", status);
  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const origin = publicOrigin(request);
  const emailChangeReturn = isEmailChangeReturn(next);

  // Supabase verifies an email-change token before redirecting to emailRedirectTo.
  // Depending on the auth flow, that redirect may not include a PKCE code. In that
  // case the confirmation has already happened and this route must never reinterpret
  // the request as a password-recovery failure.
  if (!code) {
    if (emailChangeReturn) {
      return NextResponse.redirect(
        new URL(emailChangeReturnPath(next, "confirmed"), origin),
      );
    }

    return NextResponse.redirect(
      new URL(recoveryFailurePath(next, "invalid_link"), origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (emailChangeReturn) {
      return NextResponse.redirect(
        new URL(emailChangeReturnPath(next, "error"), origin),
      );
    }

    return NextResponse.redirect(
      new URL(recoveryFailurePath(next, "expired_link"), origin),
    );
  }

  if (emailChangeReturn) {
    return NextResponse.redirect(
      new URL(emailChangeReturnPath(next, "confirmed"), origin),
    );
  }

  return NextResponse.redirect(new URL(next, origin));
}
