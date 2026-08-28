"use client";

import { useMemo } from "react";

import { DocumentVault } from "@/components/DocumentVault";
import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";
import { useVault } from "@/components/VaultProvider";
import { installDocumentImportE2eeFetchBoundary } from "@/lib/e2ee/documentImportFetchBoundary";
import { installDocumentVaultE2eeBoundary } from "@/lib/e2ee/documentVaultE2eeBoundary";
import { createClient } from "@/lib/supabase/client";

export function EncryptedDocumentVaultWorkspace({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();
  const { source, baseCurrency } = useBaseCurrencySourceData(userId);

  if (vaultStatus !== "unlocked" || !vaultKey) {
    return <div className="panel"><div className="alert">Unlock your Financial Vault to open Document Vault.</div></div>;
  }

  installDocumentVaultE2eeBoundary(
    supabase,
    vaultKey,
    userId,
    () => source,
    () => baseCurrency,
  );

  installDocumentImportE2eeFetchBoundary(
    supabase,
    vaultKey,
    userId,
    () => source,
  );

  return <DocumentVault />;
}
