"use client";

import { useEffect, useMemo, useState } from "react";

import { AiInsights } from "@/components/AiInsights";
import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";
import { useVault } from "@/components/VaultProvider";
import { installAiInsightsE2eeBoundary } from "@/lib/e2ee/aiInsightsBoundary";
import { installSmartInsightsFetchE2eeBoundary } from "@/lib/e2ee/aiInsightsFetchBoundary";
import { loadAiInsightsInputsFromVault } from "@/lib/e2ee/aiInsightsSource";
import { loadLatestAiInsightSnapshotFromVault } from "@/lib/e2ee/aiInsightSnapshotSource";
import { createClient } from "@/lib/supabase/client";
import {
  calculateAiInsightsContext,
  type AiInsightSnapshot,
  type AiInsightsInputs,
} from "@/lib/wealth/aiInsights";

export function EncryptedAiInsightsWorkspace({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();
  const { source, loading } = useBaseCurrencySourceData(userId);
  const [inputs, setInputs] = useState<AiInsightsInputs | null>(null);
  const [snapshot, setSnapshot] = useState<AiInsightSnapshot | null>(null);
  const [error, setError] = useState("");

  if (vaultStatus === "unlocked" && vaultKey) {
    installAiInsightsE2eeBoundary(
      supabase,
      vaultKey,
      userId,
      () => source,
    );
    installSmartInsightsFetchE2eeBoundary(supabase, vaultKey, userId);
  }

  useEffect(() => {
    let active = true;
    if (vaultStatus !== "unlocked" || !vaultKey || loading) {
      if (active) {
        setInputs(null);
        setSnapshot(null);
      }
      return () => {
        active = false;
      };
    }

    void Promise.all([
      loadAiInsightsInputsFromVault(supabase, vaultKey, userId, source),
      loadLatestAiInsightSnapshotFromVault(supabase, vaultKey, userId),
    ])
      .then(([nextInputs, nextSnapshot]) => {
        if (!active) return;
        setInputs(nextInputs);
        setSnapshot(nextSnapshot);
        setError("");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Smart Insights could not be opened.",
        );
      });

    return () => {
      active = false;
    };
  }, [loading, source, supabase, userId, vaultKey, vaultStatus]);

  if (vaultStatus !== "unlocked" || !vaultKey) {
    return <div className="panel"><div className="alert">Unlock your Financial Vault to open Smart Insights.</div></div>;
  }

  if (loading || !inputs) {
    return <div className="panel"><div className={error ? "alert alert-error" : "muted"}>{error || "Opening Smart Insights…"}</div></div>;
  }

  const context = calculateAiInsightsContext(inputs);

  return (
    <AiInsights
      userId={userId}
      initialInputs={inputs}
      initialSnapshot={snapshot}
      initialFingerprint={context.fingerprint}
      initialError=""
    />
  );
}
