import "server-only";

import { headers } from "next/headers";

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

/**
 * HARD BETA-DOMAIN GATE.
 *
 * Normal customers may render the Beta-domain platform only after a valid
 * invitation has created permanent server-side verification for their user id.
 * There is intentionally NO URL, query-string, cookie, or "continue free" bypass.
 * Owner / Super Admin / Admin remain role-based exemptions.
 */
export async function shouldShowBetaDomainAccessGate({
  isAdminExempt,
  betaVerified,
}: {
  userId?: string;
  isAdminExempt: boolean;
  betaVerified: boolean;
}) {
  if (isAdminExempt) return false;

  if (!(await isFiconterBetaEntryEnvironment())) {
    return false;
  }

  return !betaVerified;
}
