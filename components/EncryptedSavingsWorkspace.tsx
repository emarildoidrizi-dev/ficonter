"use client";

import { useMemo } from "react";

import { SavingsIntelligence } from "@/components/SavingsIntelligence";
import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";
import { createClient } from "@/lib/supabase/client";
import { buildSavingsClientInputs } from "@/lib/e2ee/savingsClientInputs";
import { installSavingsIntelligenceE2eeBoundary } from "@/lib/e2ee/savingsIntelligenceBoundary";

export function EncryptedSavingsWorkspace({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { source, loading } = useBaseCurrencySourceData(userId);
  const inputs = useMemo(() => buildSavingsClientInputs(source), [source]);

  installSavingsIntelligenceE2eeBoundary(supabase, () => inputs);

  if (loading) {
    return <div className="panel"><div className="muted">Opening Savings Intelligence…</div></div>;
  }

  return (
    <SavingsIntelligence
      userId={userId}
      initialInputs={inputs}
      initialError=""
    />
  );
}
