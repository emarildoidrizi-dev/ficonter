import "server-only";

import { cookies, headers } from "next/headers";

export const BETA_FREE_SESSION_COOKIE = "ficonter_beta_free_session";

function normalizeHost(value: string | null) {
  return String(value ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .split(":")[0];
}

export async function isFiconterBetaEntryEnvironment() {
  const requestHeaders = await headers();
  const host = normalizeHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );

  return (
    host === "ficonter-beta.vercel.app" ||
    process.env.VERCEL_GIT_COMMIT_REF === "feat/subscription-phase2-paypal"
  );
}

export async function shouldShowBetaDomainAccessGate({
  userId,
  isAdminExempt,
  betaVerified,
}: {
  userId: string;
  isAdminExempt: boolean;
  betaVerified: boolean;
}) {
  if (isAdminExempt || betaVerified) return false;

  if (!(await isFiconterBetaEntryEnvironment())) {
    return false;
  }

  const cookieStore = await cookies();

  return (
    cookieStore.get(BETA_FREE_SESSION_COOKIE)?.value !== userId
  );
}
