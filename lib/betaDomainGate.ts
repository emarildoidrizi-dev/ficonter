import "server-only";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";

import { createServiceClient } from "@/lib/supabase/admin";

export const BETA_LOGIN_COOKIE = "ficonter_beta_login_session";
export const BETA_FREE_COOKIE = "ficonter_beta_free_session";

function normalizeHost(value: string | null) {
  return String(value ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .split(":")[0];
}

function hashToken(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function isFiconterBetaEntryEnvironment() {
  const requestHeaders = await headers();
  const host = normalizeHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );

  // IMPORTANT: only the canonical Beta domain is gated.
  // Random Vercel Preview deployment URLs are development/test environments
  // and must never require a Beta invitation merely because they were built
  // from the Beta feature branch.
  return host === "ficonter-beta.vercel.app";
}


export async function hasFiconterBetaFreeSession() {
  const cookieStore = await cookies();
  return cookieStore.get(BETA_FREE_COOKIE)?.value === "1";
}

async function hasValidBetaLoginSession(userId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(BETA_LOGIN_COOKIE)?.value?.trim() ?? "";

  if (!token || token.length > 256) return false;

  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("beta_login_sessions")
      .select("user_id,expires_at")
      .eq("token_hash", hashToken(token))
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return false;

    const expiresAt = Date.parse(String(data.expires_at ?? ""));
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
  } catch {
    return false;
  }
}

/**
 * HARD BETA ENTRY GATE.
 *
 * For normal customers, TWO things are required on the Beta environment:
 *   1. the account has verified Beta entitlement; and
 *   2. THIS login/session has supplied a valid invitation code.
 *
 * A URL, query string, old Beta plan row, ordinary Supabase login, or cookie
 * fabricated by the browser is not enough. The opaque login cookie is checked
 * against a server-only database session record bound to the authenticated user.
 * Owner / Super Admin / Admin remain role-based exemptions.
 */
export async function shouldShowBetaDomainAccessGate({
  userId,
  isAdminExempt,
  betaVerified,
}: {
  userId: string;
  isAdminExempt: boolean;
  betaVerified: boolean;
}) {
  if (isAdminExempt) return false;

  if (!(await isFiconterBetaEntryEnvironment())) {
    return false;
  }

  // The customer may explicitly choose to use FICONTER as a Free-plan user
  // on the canonical Beta domain. This is a LOWER-privilege choice and never
  // grants Beta access. The subscription access layer also honors this cookie
  // by forcing the effective customer plan to Free for this browser session.
  if (await hasFiconterBetaFreeSession()) return false;

  if (!betaVerified) return true;

  return !(await hasValidBetaLoginSession(userId));
}
