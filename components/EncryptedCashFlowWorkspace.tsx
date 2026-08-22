"use client";

import type { ComponentProps } from "react";
import { useMemo } from "react";

import { CashFlowIntelligence } from "@/components/CashFlowIntelligence";
import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";
import { useVault } from "@/components/VaultProvider";
import { createClient } from "@/lib/supabase/client";
import { installMonthlyPlannerE2eeBoundary } from "@/lib/e2ee/monthlyPlannerClientBoundary";

type CashFlowProps = ComponentProps<typeof CashFlowIntelligence>;
type Props = Omit<CashFlowProps, "initialOpeningBalance">;

export function EncryptedCashFlowWorkspace(props: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();
  const { source } = useBaseCurrencySourceData(props.userId);

  if (vaultStatus !== "unlocked" || !vaultKey) {
    return <div className="panel"><div className="alert">Unlock your Financial Vault to open Cash Flow.</div></div>;
  }

  installMonthlyPlannerE2eeBoundary(supabase, vaultKey, props.userId);

  const activeMonth =
    props.initialInputs.monthly.at(-1)?.month ||
    props.initialInputs.generatedAt.slice(0, 7) ||
    new Date().toISOString().slice(0, 7);
  const plan = (source.plans as any[]).find((row) => row.month === activeMonth);
  const openingBalance = Number(plan?.start_balance ?? 0);

  return <CashFlowIntelligence {...props} initialOpeningBalance={openingBalance} />;
}
