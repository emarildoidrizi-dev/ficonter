"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CircleAlert,
  ListChecks,
  ReceiptText,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  isFinancialDataScope,
  subscribeFiconterDataChanges,
} from "@/lib/ficonterRealtime";
import { formatCurrency } from "@/lib/financialOptions";
import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";
import { canonicalAmountInBaseCurrency, mapDebtPaymentsToBaseCurrency, reconcileCashFlowToBaseCurrency } from "@/lib/finance/baseCurrencyReconciliation";
import { reconcileCashFlowMonthlyInputs } from "@/lib/finance/monthlyCashActuals";
import {
  calculateCashFlowIntelligence,
  normalizeCashFlowDebtPayments,
  normalizeCashFlowIntelligenceInputs,
  type CashFlowDebtPaymentInput,
  type CashFlowInsightTone,
  type CashFlowIntelligenceInputs,
} from "@/lib/wealth/cashFlowIntelligence";
import styles from "./CashFlowIntelligence.module.css";

type Props = {
  userId: string;
  initialInputs: CashFlowIntelligenceInputs;
  initialDebtPayments?: CashFlowDebtPaymentInput[];
  initialOpeningBalance?: number;
  initialError?: string;
};

const INSIGHT_ICONS = {
  positive: TrendingUp,
  info: Activity,
  warning: CircleAlert,
  critical: CircleAlert,
} satisfies Record<CashFlowInsightTone, typeof Activity>;

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(year, monthNumber - 1, 1),
  );
}

function dateLabel(value: string | null): string {
  if (!value) return "Monthly minimum";
  const parsed = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function currentMonthStartIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  ).toISOString();
}

export function CashFlowIntelligence({
  userId,
  initialInputs,
  initialDebtPayments = [],
  initialOpeningBalance = 0,
  initialError = "",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const {
    source: currencySource,
    context: currencyContext,
    baseCurrency,
  } = useBaseCurrencySourceData(userId);
  const refreshTimerRef = useRef<number | null>(null);
  const commitmentPanelRef = useRef<HTMLElement | null>(null);
  const [inputs, setInputs] = useState(initialInputs);
  const [debtPayments, setDebtPayments] = useState(initialDebtPayments);
  const [openingBalance, setOpeningBalance] = useState(initialOpeningBalance);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setInputs(initialInputs);
    setDebtPayments(initialDebtPayments);
    setOpeningBalance(initialOpeningBalance);
    setError(initialError);
  }, [
    initialDebtPayments,
    initialError,
    initialInputs,
    initialOpeningBalance,
  ]);

  const refresh = useCallback(async () => {
    setRefreshing(true);

    const [
      inputResponse,
      paymentResponse,
      billResponse,
    ] = await Promise.all([
      supabase.rpc("get_cash_flow_intelligence_inputs_v2"),
      supabase
        .from("debt_payments")
        .select("debt_id, amount_eur, paid_at")
        .gte("paid_at", currentMonthStartIso()),
      supabase
        .from("bills")
        .select("id,status,amount_eur,due_date,paid_at,transaction_id")
        .eq("user_id", userId),
    ]);

    const normalizedInputs = normalizeCashFlowIntelligenceInputs(
      inputResponse.data,
    );
    const synchronizedInputs = reconcileCashFlowMonthlyInputs(
      normalizedInputs,
      currencySource.transactions,
      billResponse.data,
    );
    const activeMonth =
      synchronizedInputs.monthly.at(-1)?.month ||
      synchronizedInputs.generatedAt.slice(0, 7) ||
      new Date().toISOString().slice(0, 7);

    const planResponse = await supabase
      .from("monthly_budget_plans")
      .select("start_balance")
      .eq("user_id", userId)
      .eq("month", activeMonth)
      .maybeSingle();

    const refreshError =
      inputResponse.error ??
      paymentResponse.error ??
      billResponse.error ??
      planResponse.error;

    if (refreshError) {
      setError(refreshError.message);
    } else {
      setInputs(synchronizedInputs);
      setDebtPayments(normalizeCashFlowDebtPayments(paymentResponse.data));
      setOpeningBalance(Number(planResponse.data?.start_balance ?? 0));
      setError("");
    }

    setRefreshing(false);
  }, [currencySource.transactions, supabase, userId]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      void refresh();
    }, 220);
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel(`cash-flow-balance:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bills",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debts",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debt_payments",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monthly_budget_plans",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monthly_budget_items",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
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
    const unsubscribe = subscribeFiconterDataChanges((change) => {
      if (isFinancialDataScope(change.scope)) scheduleRefresh();
    });
    const handleFocus = () => scheduleRefresh();
    const handleOnline = () => scheduleRefresh();
    const handleVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    const safetyTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") scheduleRefresh();
    }, 15_000);

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisible);
      window.clearInterval(safetyTimer);
    };
  }, [scheduleRefresh]);

  const reconciledInputs = useMemo(
    () =>
      reconcileCashFlowToBaseCurrency(
        inputs,
        currencySource,
        currencyContext,
      ),
    [currencyContext, currencySource, inputs],
  );
  const reconciledDebtPayments = useMemo(
    () => mapDebtPaymentsToBaseCurrency(currencySource.debtPayments, currencyContext),
    [currencyContext, currencySource.debtPayments],
  );
  const reconciledOpeningBalance = useMemo(
    () => canonicalAmountInBaseCurrency(openingBalance, currencyContext),
    [currencyContext, openingBalance],
  );
  const result = useMemo(
    () =>
      calculateCashFlowIntelligence(
        reconciledInputs,
        reconciledDebtPayments,
        reconciledOpeningBalance,
      ),
    [reconciledDebtPayments, reconciledInputs, reconciledOpeningBalance],
  );
  const maxChartValue = Math.max(
    1,
    ...result.monthly.flatMap((month) => [month.income, month.outflow]),
  );
  const leftIsPositive = result.metrics.leftAfterPayments >= 0;
  const allTimeSummary = {
    income: reconciledInputs.financialHealth.transactions.totalIncome,
    outflow:
      reconciledInputs.financialHealth.transactions.totalExpenses +
      reconciledInputs.financialHealth.transactions.totalSavings,
    netMovement:
      reconciledInputs.financialHealth.transactions.totalIncome -
      reconciledInputs.financialHealth.transactions.totalExpenses -
      reconciledInputs.financialHealth.transactions.totalSavings,
  };

  function showCommitmentBreakdown() {
    commitmentPanelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Money management</span>
          <h1>Cash flow</h1>
          <p>
            See what is available now, what is still unpaid, and what will remain
            after every listed bill and debt minimum is paid.
          </p>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          <Activity size={17} aria-hidden="true" />
          {refreshing ? "Refreshing…" : "Refresh cash flow"}
        </button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.summaryStack}>
        <section
          className={styles.summaryGroup}
          aria-labelledby="all-time-summary-title"
        >
          <span
            className={styles.summaryLabel}
            id="all-time-summary-title"
          >
            All-time summary
          </span>
          <div className={styles.metricGrid}>
            <article>
              <ArrowUpRight aria-hidden="true" />
              <span>All-time income</span>
              <strong className={styles.positive}>
                {formatCurrency(allTimeSummary.income, baseCurrency)}
              </strong>
              <small>
                Recorded income across the complete transaction history. Opening
                balances are excluded to prevent double counting.
              </small>
            </article>
            <article>
              <ArrowDownRight aria-hidden="true" />
              <span>All-time outflow</span>
              <strong>{formatCurrency(allTimeSummary.outflow, baseCurrency)}</strong>
              <small>
                Every recorded expense and saving contribution, including paid
                bills and debt payments recorded as expenses.
              </small>
            </article>
            <article
              className={styles.allTimeNetCard}
              data-negative={allTimeSummary.netMovement < 0 ? "true" : "false"}
            >
              <WalletCards aria-hidden="true" />
              <span>All-time net movement</span>
              <strong
                className={
                  allTimeSummary.netMovement >= 0
                    ? styles.positive
                    : styles.negative
                }
              >
                {formatCurrency(allTimeSummary.netMovement, baseCurrency)}
              </strong>
              <small>
                All-time income minus all-time outflow. This is historical
                movement, not the current bank balance.
              </small>
            </article>
          </div>
        </section>
        <section
          className={styles.summaryGroup}
          aria-labelledby="this-month-summary-title"
        >
          <span
            className={styles.summaryLabel}
            id="this-month-summary-title"
          >
            This month
          </span>
      <div className={styles.metricGrid}>
        <article>
          <ArrowUpRight aria-hidden="true" />
          <span>Income + start balance</span>
          <strong>{formatCurrency(result.metrics.currentMonthIncome, baseCurrency)}</strong>
          <small>Mirrors Monthly Planner start balance plus recorded income.</small>
        </article>
        <article>
          <ArrowDownRight aria-hidden="true" />
          <span>Outflow recorded this month</span>
          <strong>{formatCurrency(result.metrics.currentMonthOutflow, baseCurrency)}</strong>
          <small>Expenses, paid bills, debt payments and savings already recorded.</small>
        </article>
        <article className={styles.availableCard}>
          <WalletCards aria-hidden="true" />
          <span>Available now</span>
          <strong
            className={
              result.metrics.availableNow >= 0 ? styles.positive : styles.negative
            }
          >
            {formatCurrency(result.metrics.availableNow, baseCurrency)}
          </strong>
          <small>The current amount after all recorded activity.</small>
        </article>
      </div>
        </section>
      </div>

      <article
        className={styles.balanceCard}
        data-negative={leftIsPositive ? "false" : "true"}
      >
        <div className={styles.balanceHeader}>
          <div>
            <span>After scheduled payments</span>
            <h2>
              {leftIsPositive
                ? "Left after everything is paid"
                : "Expected shortfall after everything is paid"}
            </h2>
          </div>
          <div className={styles.balanceIcon}>
            <ListChecks size={26} aria-hidden="true" />
          </div>
        </div>

        <strong
          className={`${styles.balanceAmount} ${
            leftIsPositive ? styles.positive : styles.negative
          }`}
        >
          {formatCurrency(Math.abs(result.metrics.leftAfterPayments), baseCurrency)}
        </strong>
        <p>{result.summary}</p>

        <div className={styles.balanceEquation} aria-label="Balance calculation">
          <span>
            <small>Available now</small>
            <strong>{formatCurrency(result.metrics.availableNow, baseCurrency)}</strong>
          </span>
          <b aria-hidden="true">−</b>
          <span>
            <small>Still to pay</small>
            <strong>{formatCurrency(result.metrics.stillToPay, baseCurrency)}</strong>
          </span>
          <b aria-hidden="true">=</b>
          <span className={styles.equationResult}>
            <small>{leftIsPositive ? "Left" : "Shortfall"}</small>
            <strong
              className={leftIsPositive ? styles.positive : styles.negative}
            >
              {formatCurrency(Math.abs(result.metrics.leftAfterPayments), baseCurrency)}
            </strong>
          </span>
        </div>

        <div className={styles.balanceActions}>
          <button type="button" onClick={showCommitmentBreakdown}>
            <ListChecks size={17} aria-hidden="true" />
            View unpaid breakdown
          </button>
          {result.metrics.paidDebtMinimumsThisMonth > 0 ? (
            <small>
              {formatCurrency(result.metrics.paidDebtMinimumsThisMonth, baseCurrency)}{" "}
              of recorded debt payments was removed from Still to pay to prevent
              double counting.
            </small>
          ) : null}
        </div>
      </article>

      <div className={styles.twoColumn}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>12-month movement</span>
              <h2>Income and outflow trend</h2>
            </div>
            <div className={styles.legend} aria-label="Chart legend">
              <span>
                <i className={styles.incomeDot} />Income
              </span>
              <span>
                <i className={styles.outflowDot} />Outflow
              </span>
            </div>
          </header>
          <div
            className={styles.chart}
            role="img"
            aria-label="Twelve-month income and outflow chart"
          >
            {result.monthly.map((month) => (
              <div className={styles.chartMonth} key={month.month}>
                <div className={styles.barArea}>
                  <span
                    className={styles.incomeBar}
                    style={{
                      height: `${Math.max(2, (month.income / maxChartValue) * 100)}%`,
                    }}
                    title={`Income ${formatCurrency(month.income, baseCurrency)}`}
                  />
                  <span
                    className={styles.outflowBar}
                    style={{
                      height: `${Math.max(2, (month.outflow / maxChartValue) * 100)}%`,
                    }}
                    title={`Outflow ${formatCurrency(month.outflow, baseCurrency)}`}
                  />
                </div>
                <small>{monthLabel(month.month)}</small>
              </div>
            ))}
          </div>
          <div className={styles.trendSummary}>
            <span>
              <small>Recent three-month net average</small>
              <strong>{formatCurrency(result.metrics.recentNetAverage, baseCurrency)}</strong>
            </span>
            <span>
              <small>Change vs previous three months</small>
              <strong
                className={
                  result.metrics.trendChange >= 0 ? styles.positive : styles.negative
                }
              >
                {result.metrics.trendChange >= 0 ? "+" : ""}
                {formatCurrency(result.metrics.trendChange, baseCurrency)}
              </strong>
            </span>
            <span>
              <small>Income consistency</small>
              <strong>{percentage(result.metrics.incomeConsistency)}</strong>
            </span>
          </div>
        </article>

        <article className={styles.panel} ref={commitmentPanelRef}>
          <header className={styles.panelHeader}>
            <div>
              <span>Unpaid breakdown</span>
              <h2>Still to pay</h2>
            </div>
            <strong className={styles.commitmentTotal}>
              {formatCurrency(result.metrics.stillToPay, baseCurrency)}
            </strong>
          </header>
          <div className={styles.commitmentSplit}>
            <span>
              <ReceiptText aria-hidden="true" />
              <small>Unpaid bills</small>
              <strong>{formatCurrency(result.commitments.billsTotal, baseCurrency)}</strong>
            </span>
            <span>
              <ShieldCheck aria-hidden="true" />
              <small>Remaining debt minimums</small>
              <strong>{formatCurrency(result.commitments.debtMinimums, baseCurrency)}</strong>
            </span>
          </div>
          <div className={`${styles.commitmentList} ficonter-scroll-region`}>
            {result.commitments.items.length ? (
              result.commitments.items.map((item) => (
                <div className={styles.commitmentRow} key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.category} · {dateLabel(item.dueDate)}
                    </small>
                    {item.kind === "debt" && (item.paidThisMonth ?? 0) > 0 ? (
                      <em>
                        {formatCurrency(item.paidThisMonth ?? 0, baseCurrency)} already
                        recorded this month
                      </em>
                    ) : null}
                  </div>
                  <b>{formatCurrency(item.amount, baseCurrency)}</b>
                </div>
              ))
            ) : (
              <p className={styles.empty}>
                No unpaid bills or remaining debt minimums are currently listed.
              </p>
            )}
          </div>
        </article>
      </div>

      <div className={styles.twoColumn}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Last 90 days</span>
              <h2>Spending pressure</h2>
            </div>
          </header>
          <div className={styles.categoryList}>
            {result.categories.length ? (
              result.categories.map((category) => (
                <div className={styles.categoryRow} key={category.category}>
                  <div className={styles.categoryTop}>
                    <div>
                      <strong>{category.category}</strong>
                      <small>{percentage(category.share)} of recent expenses</small>
                    </div>
                    <div>
                      <b>{formatCurrency(category.recentAmount, baseCurrency)}</b>
                      <small
                        className={
                          category.changePercent !== null &&
                          category.changePercent > 0
                            ? styles.negative
                            : styles.positive
                        }
                      >
                        {category.changePercent === null
                          ? "New activity"
                          : `${category.changePercent > 0 ? "+" : ""}${category.changePercent.toFixed(0)}% vs prior 90 days`}
                      </small>
                    </div>
                  </div>
                  <div className={styles.categoryTrack} aria-hidden="true">
                    <span
                      style={{
                        width: `${Math.min(100, category.share * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className={styles.empty}>
                Expense categories will appear as activity is recorded.
              </p>
            )}
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Clear calculation</span>
              <h2>What is included</h2>
            </div>
          </header>
          <div className={styles.insightList}>
            {result.insights.map((insight) => {
              const Icon = INSIGHT_ICONS[insight.tone];
              return (
                <div
                  className={styles.insight}
                  data-tone={insight.tone}
                  key={insight.id}
                >
                  <div className={styles.insightIcon}>
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <strong>{insight.title}</strong>
                    <p>{insight.detail}</p>
                    <small>{insight.action}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <p className={styles.methodNote}>
        Left after everything is paid equals Available now minus only the unpaid
        bills and remaining debt minimums shown in the breakdown. A recorded bill
        or debt payment reduces Available now and is removed from Still to pay, so
        it is never deducted twice.
      </p>
    </section>
  );
}
