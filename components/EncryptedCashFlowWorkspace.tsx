"use client";

import { useMemo } from "react";

import { CashFlowIntelligence } from "@/components/CashFlowIntelligence";
import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";
import { useVault } from "@/components/VaultProvider";
import { createClient } from "@/lib/supabase/client";
import { finiteNumber } from "@/lib/finance/money";
import { buildCashFlowClientInputs } from "@/lib/e2ee/cashFlowClientInputs";
import { installCashFlowIntelligenceE2eeBoundary } from "@/lib/e2ee/cashFlowIntelligenceBoundary";
import { installMonthlyPlannerE2eeBoundary } from "@/lib/e2ee/monthlyPlannerClientBoundary";

export function EncryptedCashFlowWorkspace({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();
  const { source, loading } = useBaseCurrencySourceData(userId);
  const inputs = useMemo(() => buildCashFlowClientInputs(source), [source]);
  const activeMonth = inputs.monthly.at(-1)?.month ?? new Date().toISOString().slice(0, 7);
  const openingBalance = useMemo(
    () =>
      finiteNumber(
        source.plans.find((plan) => plan.month === activeMonth)?.start_balance,
      ),
    [activeMonth, source.plans],
  );
  const debtPayments = useMemo(
    () =>
      source.debtPayments
        .filter((payment) => Boolean(payment.paid_at))
        .map((payment) => ({
          debtId: payment.debt_id,
          amountEur: Math.max(0, finiteNumber(payment.amount_eur)),
          paidAt: payment.paid_at,
        })),
    [source.debtPayments],
  );

  if (vaultStatus !== "unlocked" || !vaultKey) {
    return <div className="panel"><div className="alert">Unlock your Financial Vault to open Cash Flow.</div></div>;
  }

  installMonthlyPlannerE2eeBoundary(supabase, vaultKey, userId);
  installCashFlowIntelligenceE2eeBoundary(
    supabase,
    () => inputs,
    () => source,
  );

  if (loading) {
    return <div className="panel"><div className="muted">Opening Cash Flow…</div></div>;
  }

  return (
    <CashFlowIntelligence
      userId={userId}
      initialInputs={inputs}
      initialDebtPayments={debtPayments}
      initialOpeningBalance={openingBalance}
      initialError=""
    />
  );
}
