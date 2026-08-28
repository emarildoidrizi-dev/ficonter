"use client";

import { useMemo } from "react";

import { FinancialIndependence } from "@/components/FinancialIndependence";
import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";
import { useVault } from "@/components/VaultProvider";
import { installFinancialIndependenceE2eeBoundary } from "@/lib/e2ee/financialIndependenceBoundary";
import { createClient } from "@/lib/supabase/client";

export function EncryptedFinancialIndependenceWorkspace({
  userId,
}: {
  userId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();
  const { source, loading } = useBaseCurrencySourceData(userId);

  if (vaultStatus !== "unlocked" || !vaultKey) {
    return (
      <div className="panel">
        <div className="alert">Unlock your Financial Vault to open Financial Independence.</div>
      </div>
    );
  }

  installFinancialIndependenceE2eeBoundary(
    supabase,
    vaultKey,
    userId,
    () => source,
  );

  if (loading) {
    return (
      <div className="panel">
        <div className="muted">Opening Financial Independence…</div>
      </div>
    );
  }

  return <FinancialIndependence userId={userId} />;
}
