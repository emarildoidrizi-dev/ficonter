"use client";

import { useMemo } from "react";

import { FinancialSetupGuide } from "@/components/FinancialSetupGuide";
import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";
import { installFinancialHealthE2eeBoundary } from "@/lib/e2ee/financialHealthBoundary";
import { createClient } from "@/lib/supabase/client";
import { buildNetWorthGrowthInputsFromSource } from "@/lib/wealth/netWorthClientInputs";
import type { SetupAcknowledgements } from "@/lib/wealth/setupReadiness";

export function EncryptedFinancialSetupWorkspace({
  userId,
  initialAcknowledgements,
}: {
  userId: string;
  initialAcknowledgements: SetupAcknowledgements;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { source, loading } = useBaseCurrencySourceData(userId);
  const inputs = useMemo(
    () => buildNetWorthGrowthInputsFromSource(source).wealthScore.financialHealth,
    [source],
  );

  installFinancialHealthE2eeBoundary(supabase, () => source);

  if (loading) {
    return <div className="panel"><div className="muted">Opening Financial setup…</div></div>;
  }

  return (
    <FinancialSetupGuide
      userId={userId}
      initialInputs={inputs}
      initialAcknowledgements={initialAcknowledgements}
      initialError=""
    />
  );
}
