"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const [source, setSource] = useState<CurrencySourceData>(EMPTY_SOURCE);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const [
      transactions,
      bills,
      debts,
      debtPayments,
      goals,
      plans,
      items,
    ] = await Promise.all([
      supabase
        .from("transactions")
        .select(
          "id,type,description,category,amount,currency,amount_eur,exchange_rate_to_eur,transaction_date,occurred_at",
        )
        .eq("user_id", userId),
      supabase
        .from("bills")
        .select(
          "id,name,category,status,amount,currency,amount_eur,due_date,paid_at,transaction_id",
        )
        .eq("user_id", userId),
      supabase
        .from("debts")
        .select(
          "id,name,category,currency,original_balance,current_balance,minimum_payment,original_balance_eur,current_balance_eur,minimum_payment_eur,annual_interest_rate,status,updated_at",
        )
        .eq("user_id", userId),
      supabase
        .from("debt_payments")
        .select("id,debt_id,amount,currency,amount_eur,paid_at")
        .eq("user_id", userId),
      supabase
        .from("goals")
        .select("id,target_amount,current_amount,status")
        .eq("user_id", userId),
      supabase
        .from("monthly_budget_plans")
        .select("month,start_balance")
        .eq("user_id", userId),
      supabase
        .from("monthly_budget_items")
        .select("month,section,planned_amount")
        .eq("user_id", userId),
    ]);

    setSource({
      transactions: (transactions.data ?? []) as CurrencySourceData["transactions"],
      bills: (bills.data ?? []) as CurrencySourceData["bills"],
      debts: (debts.data ?? []) as CurrencySourceData["debts"],
      debtPayments: (debtPayments.data ?? []) as CurrencySourceData["debtPayments"],
      goals: (goals.data ?? []) as CurrencySourceData["goals"],
      plans: (plans.data ?? []) as CurrencySourceData["plans"],
      items: (items.data ?? []) as CurrencySourceData["items"],
    });
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh, baseCurrency]);

  useEffect(() => {
    const schedule = () => void refresh();
    window.addEventListener("ficonter:data-changed", schedule);
    window.addEventListener("ficonter:transaction-created", schedule);
    window.addEventListener("ficonter:transaction-upserted", schedule);
    window.addEventListener("ficonter:transaction-deleted", schedule);
    return () => {
      window.removeEventListener("ficonter:data-changed", schedule);
      window.removeEventListener("ficonter:transaction-created", schedule);
      window.removeEventListener("ficonter:transaction-upserted", schedule);
      window.removeEventListener("ficonter:transaction-deleted", schedule);
    };
  }, [refresh]);

  const dates = useMemo(
    () => [
      ...source.transactions.map((row) => row.transaction_date),
      ...source.bills.map(
        (row) => row.paid_at?.slice(0, 10) ?? row.due_date,
      ),
      ...source.debtPayments.map((row) => row.paid_at?.slice(0, 10)),
    ],
    [source],
  );

  const { rateForDate } = useHistoricalReportingRates(dates);

  const context = useMemo<BaseCurrencyReconciliationContext>(
    () => ({
      baseCurrency,
      latestRate,
      rateForDate,
    }),
    [baseCurrency, latestRate, rateForDate],
  );

  return {
    source,
    context,
    baseCurrency,
    latestRate,
    loading,
    refresh,
  };
}
