"use client";

import { useMemo } from "react";

import { EmergencyFundIntelligence } from "@/components/EmergencyFundIntelligence";
import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";
import { createClient } from "@/lib/supabase/client";
import { buildEmergencyFundClientInputs } from "@/lib/e2ee/emergencyFundClientInputs";
import { installEmergencyFundIntelligenceE2eeBoundary } from "@/lib/e2ee/emergencyFundIntelligenceBoundary";

export function EncryptedEmergencyFundWorkspace({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { source, loading } = useBaseCurrencySourceData(userId);
  const inputs = useMemo(() => buildEmergencyFundClientInputs(source), [source]);

  installEmergencyFundIntelligenceE2eeBoundary(supabase, () => inputs);

  if (loading) {
    return <div className="panel"><div className="muted">Opening Emergency Fund…</div></div>;
  }

  return (
    <EmergencyFundIntelligence
      userId={userId}
      initialInputs={inputs}
      initialError=""
    />
  );
}
