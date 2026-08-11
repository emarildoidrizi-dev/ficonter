"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Landmark,
  PiggyBank,
  TrendingDown,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/financialOptions";
import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";
import { reconcileNetWorthGrowthToBaseCurrency } from "@/lib/finance/baseCurrencyReconciliation";
import { calculateWealthScore } from "@/lib/wealth/wealthScore";
import {
  normalizeNetWorthGrowthInputs,
  type NetWorthGrowthInputs,
} from "@/lib/wealth/netWorthGrowth";
import { WealthScore } from "@/components/WealthScore";
import { NetWorthGrowth } from "@/components/NetWorthGrowth";
import styles from "./NetWorthLive.module.css";

export function NetWorthLive({
  userId,
  initialGrowthInputs,
  initialError = "",
}: {
  userId: string;
  initialGrowthInputs: NetWorthGrowthInputs;
  initialError?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const {
    source: currencySource,
    context: currencyContext,
    baseCurrency,
  } = useBaseCurrencySourceData(userId);
  const refreshTimerRef = useRef<number | null>(null);
  const [inputs, setInputs] = useState(initialGrowthInputs);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setInputs(initialGrowthInputs);
    setError(initialError);
  }, [initialGrowthInputs, initialError]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const { data, error: refreshError } = await supabase.rpc(
      "get_net_worth_growth_inputs",
    );

    if (refreshError) {
      setError(refreshError.message);
    } else {
      setInputs(normalizeNetWorthGrowthInputs(data));
      setError("");
    }
    setRefreshing(false);
  }, [supabase]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, 180);
  }, [refresh]);

  useEffect(() => {
    const onPlatformChange = () => scheduleRefresh();
    window.addEventListener("ficonter:data-changed", onPlatformChange);
    return () => {
      window.removeEventListener("ficonter:data-changed", onPlatformChange);
    };
  }, [scheduleRefresh]);

  useEffect(() => {
    if (!userId) return;

    const refreshOnly = () => scheduleRefresh();
    const channel = supabase
      .channel(`net-worth-growth-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${userId}`,
        },
        refreshOnly,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debts",
          filter: `user_id=eq.${userId}`,
        },
        refreshOnly,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debt_payments",
          filter: `user_id=eq.${userId}`,
        },
        refreshOnly,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "goals",
          filter: `user_id=eq.${userId}`,
        },
        refreshOnly,
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh, supabase, userId]);

  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, [refresh]);

  const reconciledInputs = useMemo(
    () => reconcileNetWorthGrowthToBaseCurrency(inputs, currencySource, currencyContext),
    [currencyContext, currencySource, inputs],
  );
  const result = useMemo(
    () => calculateWealthScore(reconciledInputs.wealthScore),
    [reconciledInputs.wealthScore],
  );
  const liabilities = reconciledInputs.wealthScore.liabilities;
  const money = useCallback(
    (value: number) => formatCurrency(value, baseCurrency),
    [baseCurrency],
  );

  return (
    <section className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Wealth Engine</span>
          <h1>Net worth</h1>
          <p>
            Your recorded capital, savings and liabilities—connected to one
            Wealth Score and a transparent growth history.
          </p>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.cards}>
        <article>
          <WalletCards />
          <span>Available cash</span>
          <strong
            className={
              result.metrics.availableCash >= 0 ? styles.positive : styles.negative
            }
          >
            {money(result.metrics.availableCash)}
          </strong>
        </article>
        <article>
          <PiggyBank />
          <span>Recorded savings</span>
          <strong>{money(result.metrics.recordedSavings)}</strong>
        </article>
        <article>
          <TrendingDown />
          <span>Total liabilities</span>
          <strong>{money(result.metrics.currentDebt)}</strong>
        </article>
        <article>
          <Landmark />
          <span>Net wealth position</span>
          <strong
            className={
              result.metrics.netWorth >= 0 ? styles.positive : styles.negative
            }
          >
            {money(result.metrics.netWorth)}
          </strong>
        </article>
      </div>

      <WealthScore result={result} error={error} displayCurrency={baseCurrency} />

      <NetWorthGrowth inputs={reconciledInputs} displayCurrency={baseCurrency} />

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span>Liability detail</span>
            <h2>Outstanding liabilities</h2>
          </div>
          <strong>
            {result.metrics.activeDebtAccounts} active debt
            {result.metrics.activeDebtAccounts === 1 ? "" : "s"}
          </strong>
        </div>

        {liabilities.length ? (
          <div
            className={`${styles.liabilityList} ficonter-scroll-region`}
            tabIndex={liabilities.length > 5 ? 0 : undefined}
            aria-label="Outstanding liabilities. Scroll for additional debt accounts."
          >
            {liabilities.map((debt) => (
              <div className={styles.row} key={debt.id}>
                <div>
                  <span>{debt.name}</span>
                  <small>
                    {debt.annualInterestRate.toFixed(2)}% annual interest · {Math.max(
                      0,
                      debt.originalBalance - debt.currentBalance,
                    ).toLocaleString("en-US", {
                      style: "currency",
                      currency: "EUR",
                    })}{" "}
                    repaid
                  </small>
                </div>
                <strong>{money(debt.currentBalance)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No outstanding debt.</p>
        )}
      </div>
    </section>
  );
}
