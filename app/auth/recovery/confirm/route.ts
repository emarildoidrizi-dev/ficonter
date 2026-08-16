import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { normalizeAuthEntry, withAuthEntry } from "@/lib/auth/recovery";

function safeNextPath(value: string | null, fallback = "/update-password"): string {
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

function failurePath(next: string, error: "invalid_link" | "expired_link") {
  const nextUrl = new URL(next, "https://ficonter.invalid");
  const entry = normalizeAuthEntry(nextUrl.searchParams.get("entry"));
  return withAuthEntry(`/recover-account?mode=password&error=${error}`, entry);
}

export async function POST(request: NextRequest) {
  const origin = publicOrigin(request);
  const formData = await request.formData();
  const tokenHash = String(formData.get("token_hash") ?? "").trim();
  const type = String(formData.get("type") ?? "") as EmailOtpType;
  const next = safeNextPath(String(formData.get("next") ?? ""));

  // Recovery tokens must never be consumed from a GET request. The user has
  // explicitly submitted the interstitial form before verification reaches
  // this route, protecting one-time tokens from email prefetch/scanner GETs.
  if (!tokenHash || type !== "recovery") {
    return NextResponse.redirect(new URL(failurePath(next, "invalid_link"), origin), 303);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(new URL(failurePath(next, "expired_link"), origin), 303);
  }

  return NextResponse.redirect(new URL(next, origin), 303);
}
