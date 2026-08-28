"use client";

import type { CustomerRecoveryAccessState } from "@/lib/vaultRecovery/customerAccess";
import { VaultRecoveryCustomerAccess } from "@/components/VaultRecoveryCustomerAccess";

/**
 * Dedicated module identity for the current Assisted Recovery customer UI.
 *
 * This wrapper intentionally lives at a new module path so Next/Vercel cannot
 * satisfy the recovery route from an older client-module reference retained by
 * a long-lived dashboard session. The underlying recovery component remains the
 * single source of truth for the actual security workflow.
 */
export function VaultRecoveryCustomerAccessV2({
  recoveryRequestId,
  initialAccess,
}: {
  recoveryRequestId: string;
  initialAccess: CustomerRecoveryAccessState | null;
}) {
  return (
    <div data-ficonter-recovery-ui-version="2">
      <VaultRecoveryCustomerAccess
        recoveryRequestId={recoveryRequestId}
        initialAccess={initialAccess}
      />
    </div>
  );
}
