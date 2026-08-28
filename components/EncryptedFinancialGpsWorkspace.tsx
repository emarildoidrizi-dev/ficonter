"use client";

import { useEffect, useMemo, useState } from "react";

import { FinancialGps } from "@/components/FinancialGps";
import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";
import { useVault } from "@/components/VaultProvider";
import { installAiInsightsE2eeBoundary } from "@/lib/e2ee/aiInsightsBoundary";
import { loadAiInsightsInputsFromVault } from "@/lib/e2ee/aiInsightsSource";
import { createClient } from "@/lib/supabase/client";
import type { AiInsightsInputs } from "@/lib/wealth/aiInsights";
import type { SetupAcknowledgements } from "@/lib/wealth/setupReadiness";

export function EncryptedFinancialGpsWorkspace({
  userId,
  initialAcknowledgements,
}: {
  userId: string;
  initialAcknowledgements: SetupAcknowledgements;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();
  const { source, loading } = useBaseCurrencySourceData(userId);
  const [inputs, setInputs] = useState<AiInsightsInputs | null>(null);
  const [error, setError] = useState("");

  if (vaultStatus === "unlocked" && vaultKey) {
    installAiInsightsE2eeBoundary(
      supabase,
      vaultKey,
      userId,
      () => source,
    );
  }

  useEffect(() => {
    let active = true;
    if (vaultStatus !== "unlocked" || !vaultKey || loading) {
      if (active) setInputs(null);
      return () => {
        active = false;
      };
    }

    void loadAiInsightsInputsFromVault(supabase, vaultKey, userId, source)
      .then((value) => {
        if (!active) return;
        setInputs(value);
        setError("");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Financial GPS could not be opened.");
      });

    return () => {
      active = false;
    };
  }, [loading, source, supabase, userId, vaultKey, vaultStatus]);

  if (vaultStatus !== "unlocked" || !vaultKey) {
    return <div className="panel"><div className="alert">Unlock your Financial Vault to open Financial GPS.</div></div>;
  }

  if (loading || !inputs) {
    return <div className="panel"><div className={error ? "alert alert-error" : "muted"}>{error || "Opening Financial GPS…"}</div></div>;
  }

  return (
    <FinancialGps
      userId={userId}
      initialInputs={inputs}
      initialAcknowledgements={initialAcknowledgements}
      initialError=""
    />
  );
}
