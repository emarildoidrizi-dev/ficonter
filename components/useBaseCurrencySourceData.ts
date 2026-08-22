"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEncryptedTransactions } from "@/components/EncryptedTransactionProvider";
import { useEncryptedBills } from "@/components/EncryptedBillProvider";
import { useVault } from "@/components/VaultProvider";
import { decryptDebtPayload } from "@/lib/e2ee/debtPayload";
import { decryptDebtPaymentPayload } from "@/lib/e2ee/debtPaymentPayload";
import { decryptGoalPayload } from "@/lib/e2ee/goalPayload";
import { decryptMonthlyPlanPayload } from "@/lib/e2ee/monthlyPlanPayload";
import { decryptMonthlyPlanItemPayload } from "@/lib/e2ee/monthlyPlanItemPayload";
import { isFiconterNavigationPending } from "@/lib/navigationRuntime";
import {
  isFinancialDataScope,
  parseFiconterDataChange,
  type FiconterDataChange,
} from "@/lib/ficonterRealtime";
import {
  useCurrencyDisplay,
  useHistoricalReportingRates,
} from "@/components/CurrencyDisplayProvider";
import type {
  BaseCurrencyReconciliationContext,
  CurrencySourceData,
} from "@/lib/finance/baseCurrencyReconciliation";

const EMPTY_SOURCE: CurrencySourceData = {
  transactions: [],
  bills: [],
  debts: [],
  debtPayments: [],
  goals: [],
  plans: [],
  items: [],
};

export function useBaseCurrencySourceData(userId: string) {
  const supabase = useMemo(() => createClient(), []);
  const { baseCurrency, latestRate } = useCurrencyDisplay();
  const { status: vaultStatus, vaultKey } = useVault();
  const { transactions: encryptedTransactions, loading: encryptedTransactionsLoading } = useEncryptedTransactions();
  const { bills: encryptedBills, loading: encryptedBillsLoading } = useEncryptedBills();
  const [source, setSource] = useState<CurrencySourceData>(EMPTY_SOURCE);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const queuedRef = useRef(false);
  const loadedRef = useRef(false);
  const mountedRef = useRef(true);
  const eventTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (eventTimerRef.current) window.clearTimeout(eventTimerRef.current);
    };
  }, []);

  const refresh = useCallback((): Promise<void> => {
    if (!userId) return Promise.resolve();
    if (inFlightRef.current) {
      queuedRef.current = true;
      return inFlightRef.current;
    }

    const task = (async () => {
      if (!loadedRef.current && mountedRef.current) setLoading(true);
      do {
        queuedRef.current = false;
        const debtsTable = supabase.from("debts") as any;
        const debtPaymentsTable = supabase.from("debt_payments") as any;
        const goalsTable = supabase.from("goals") as any;
        const plansTable = supabase.from("monthly_budget_plans") as any;
        const itemsTable = supabase.from("monthly_budget_items") as any;

        const [debtsResult, debtPaymentsResult, goalsResult, plansResult, itemsResult] = await Promise.all([
          debtsTable.select("id,user_id,name,category,currency,original_balance,current_balance,minimum_payment,original_balance_eur,current_balance_eur,minimum_payment_eur,annual_interest_rate,status,updated_at,encrypted_payload,encryption_version").eq("user_id", userId),
          debtPaymentsTable.select("id,debt_id,user_id,amount,currency,amount_eur,paid_at,encrypted_payload,encryption_version").eq("user_id", userId),
          goalsTable.select("id,user_id,target_amount,current_amount,status,encrypted_payload,encryption_version").eq("user_id", userId),
          plansTable.select("id,user_id,month,start_balance,spending_budget,created_at,updated_at,encrypted_payload,encryption_version,e2ee_revision").eq("user_id", userId),
          itemsTable.select("id,user_id,month,section,label,planned_amount,position,created_at,updated_at,encrypted_payload,encryption_version,e2ee_revision").eq("user_id", userId),
        ]);

        let debtRows = (debtsResult.data ?? []) as any[];
        let paymentRows = (debtPaymentsResult.data ?? []) as any[];
        let goalRows = (goalsResult.data ?? []) as any[];
        let planRows = (plansResult.data ?? []) as any[];
        let itemRows = (itemsResult.data ?? []) as any[];

        if (vaultStatus === "unlocked" && vaultKey) {
          debtRows = await Promise.all(debtRows.map(async (row: any) => row.encryption_version === 1 && row.encrypted_payload ? { ...row, ...(await decryptDebtPayload(vaultKey, userId, row)) } : row));
          paymentRows = await Promise.all(paymentRows.map(async (row: any) => row.encryption_version === 1 && row.encrypted_payload ? { ...row, ...(await decryptDebtPaymentPayload(vaultKey, userId, row)) } : row));
          goalRows = await Promise.all(goalRows.map(async (row: any) => row.encryption_version === 1 && row.encrypted_payload ? { ...row, ...(await decryptGoalPayload(vaultKey, userId, row)) } : row));
          planRows = await Promise.all(planRows.map(async (row: any) => row.encryption_version === 1 && row.encrypted_payload ? { ...row, ...(await decryptMonthlyPlanPayload(vaultKey, userId, row)) } : row));
          itemRows = await Promise.all(itemRows.map(async (row: any) => row.encryption_version === 1 && row.encrypted_payload ? { ...row, ...(await decryptMonthlyPlanItemPayload(vaultKey, userId, row)) } : row));
        }

        if (mountedRef.current) {
          setSource({
            transactions: encryptedTransactions as CurrencySourceData["transactions"],
            bills: encryptedBills as CurrencySourceData["bills"],
            debts: debtRows as CurrencySourceData["debts"],
            debtPayments: paymentRows as CurrencySourceData["debtPayments"],
            goals: goalRows as CurrencySourceData["goals"],
            plans: planRows as CurrencySourceData["plans"],
            items: itemRows as CurrencySourceData["items"],
          });
          loadedRef.current = true;
          setLoading(false);
        }
      } while (queuedRef.current && mountedRef.current && !isFiconterNavigationPending());
    })().finally(() => { inFlightRef.current = null; });

    inFlightRef.current = task;
    return task;
  }, [encryptedBills, encryptedTransactions, supabase, userId, vaultKey, vaultStatus]);

  useEffect(() => { void refresh(); }, [refresh, baseCurrency]);

  useEffect(() => {
    const schedule = (event?: Event) => {
      if (event?.type === "ficonter:data-changed") {
        const change = parseFiconterDataChange((event as CustomEvent<FiconterDataChange>).detail);
        if (change && !isFinancialDataScope(change.scope)) return;
      }
      if (isFiconterNavigationPending() || document.visibilityState !== "visible") return;
      if (eventTimerRef.current) window.clearTimeout(eventTimerRef.current);
      eventTimerRef.current = window.setTimeout(() => {
        eventTimerRef.current = null;
        if (!isFiconterNavigationPending()) void refresh();
      }, 180);
    };

    window.addEventListener("ficonter:data-changed", schedule);
    window.addEventListener("ficonter:transaction-created", schedule);
    window.addEventListener("ficonter:transaction-upserted", schedule);
    window.addEventListener("ficonter:transaction-deleted", schedule);
    return () => {
      if (eventTimerRef.current) window.clearTimeout(eventTimerRef.current);
      window.removeEventListener("ficonter:data-changed", schedule);
      window.removeEventListener("ficonter:transaction-created", schedule);
      window.removeEventListener("ficonter:transaction-upserted", schedule);
      window.removeEventListener("ficonter:transaction-deleted", schedule);
    };
  }, [refresh]);

  const dates = useMemo(() => [
    ...source.transactions.map((row) => row.transaction_date),
    ...source.bills.map((row) => row.paid_at?.slice(0, 10) ?? row.due_date),
    ...source.debtPayments.map((row) => row.paid_at?.slice(0, 10)),
  ], [source]);

  const { rateForDate } = useHistoricalReportingRates(dates);
  const context = useMemo<BaseCurrencyReconciliationContext>(() => ({ baseCurrency, latestRate, rateForDate }), [baseCurrency, latestRate, rateForDate]);

  return {
    source,
    context,
    baseCurrency,
    latestRate,
    loading: loading || encryptedTransactionsLoading || encryptedBillsLoading,
    refresh,
  };
}
