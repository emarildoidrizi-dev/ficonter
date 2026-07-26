"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CircleAlert,
  Gauge,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/financialOptions";
import {
  calculateCashFlowIntelligence,
  normalizeCashFlowIntelligenceInputs,
  type CashFlowIntelligenceInputs,
  type CashFlowInsightTone,
} from "@/lib/wealth/cashFlowIntelligence";
import styles from "./CashFlowIntelligence.module.css";

type Props = {
  userId: string;
  initialInputs: CashFlowIntelligenceInputs;
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

export function CashFlowIntelligence({
  userId,
  initialInputs,
  initialError = "",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const refreshTimerRef = useRef<number | null>(null);
  const [inputs, setInputs] = useState(initialInputs);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setInputs(initialInputs);
    setError(initialError);
  }, [initialError, initialInputs]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const { data, error: refreshError } = await supabase.rpc(
      "get_cash_flow_intelligence_inputs",
    );

    if (refreshError) {
      setError(refreshError.message);
    } else {
      setInputs(normalizeCashFlowIntelligenceInputs(data));
      setError("");
    }
    setRefreshing(false);
  }, [supabase]);

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
      .channel(`cash-flow-intelligence:${userId}`)
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
    function handleVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, [refresh]);

  const result = useMemo(() => calculateCashFlowIntelligence(inputs), [inputs]);
  const maxChartValue = Math.max(
    1,
    ...result.monthly.flatMap((month) => [month.income, month.outflow]),
  );
  const statusSlug = result.label.toLowerCase();

  return (
    <section className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Wealth Engine</span>
          <h1>Cash flow intelligence</h1>
          <p>
            Understand monthly movement, known commitments and spending pressure
            using the same Transactions, Bills and Planner data already powering
            FICONTER.
          </p>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          <Activity size={17} aria-hidden="true" />
          {refreshing ? "Refreshing…" : "Refresh intelligence"}
        </button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.metricGrid}>
        <article>
          <ArrowUpRight aria-hidden="true" />
          <span>Current-month income</span>
          <strong>{formatCurrency(result.metrics.currentMonthIncome, "EUR")}</strong>
          <small>Recorded income this month</small>
        </article>
        <article>
          <ArrowDownRight aria-hidden="true" />
          <span>Current-month outflow</span>
          <strong>{formatCurrency(result.metrics.currentMonthOutflow, "EUR")}</strong>
          <small>Expenses and recorded savings</small>
        </article>
        <article>
          <WalletCards aria-hidden="true" />
          <span>Current-month net flow</span>
          <strong
            className={
              result.metrics.currentMonthNetCashFlow >= 0
                ? styles.positive
                : styles.negative
            }
          >
            {formatCurrency(result.metrics.currentMonthNetCashFlow, "EUR")}
          </strong>
          <small>Income minus every outflow</small>
        </article>
        <article>
          <CalendarClock aria-hidden="true" />
          <span>Known 30-day commitments</span>
          <strong>{formatCurrency(result.metrics.knownCommitments, "EUR")}</strong>
          <small>Upcoming bills and debt minimums</small>
        </article>
      </div>

      <article className={styles.outlook} data-status={statusSlug}>
        <div className={styles.outlookIcon}>
          <Gauge size={26} aria-hidden="true" />
        </div>
        <div className={styles.outlookCopy}>
          <div className={styles.outlookTitle}>
            <div>
              <span>30-day outlook</span>
              <h2>{result.label}</h2>
            </div>
            <div className={styles.confidence}>
              <small>Forecast confidence</small>
              <strong>{result.confidence}</strong>
              <span>{result.dataCoverage}% coverage</span>
            </div>
          </div>
          <p>{result.summary}</p>
          <div className={styles.outlookMetrics}>
            <span>
              <small>Expected income</small>
              <strong>{formatCurrency(result.metrics.expectedIncome, "EUR")}</strong>
            </span>
            <span>
              <small>Conservative outflow</small>
              <strong>{formatCurrency(result.metrics.expectedOutflow, "EUR")}</strong>
            </span>
            <span>
              <small>Projected net flow</small>
              <strong
                className={
                  result.metrics.projectedNetCashFlow >= 0
                    ? styles.positive
                    : styles.negative
                }
              >
                {formatCurrency(result.metrics.projectedNetCashFlow, "EUR")}
              </strong>
            </span>
            <span>
              <small>Projected margin</small>
              <strong>{percentage(result.metrics.projectedMargin)}</strong>
            </span>
          </div>
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
              <span><i className={styles.incomeDot} />Income</span>
              <span><i className={styles.outflowDot} />Outflow</span>
            </div>
          </header>

          <div className={styles.chart} role="img" aria-label="Twelve-month income and outflow chart">
            {result.monthly.map((month) => (
              <div className={styles.chartMonth} key={month.month}>
                <div className={styles.barArea}>
                  <span
                    className={styles.incomeBar}
                    style={{ height: `${Math.max(2, (month.income / maxChartValue) * 100)}%` }}
                    title={`Income ${formatCurrency(month.income, "EUR")}`}
                  />
                  <span
                    className={styles.outflowBar}
                    style={{ height: `${Math.max(2, (month.outflow / maxChartValue) * 100)}%` }}
                    title={`Outflow ${formatCurrency(month.outflow, "EUR")}`}
                  />
                </div>
                <small>{monthLabel(month.month)}</small>
              </div>
            ))}
          </div>

          <div className={styles.trendSummary}>
            <span>
              <small>Recent three-month net average</small>
              <strong>{formatCurrency(result.metrics.recentNetAverage, "EUR")}</strong>
            </span>
            <span>
              <small>Change vs previous three months</small>
              <strong
                className={result.metrics.trendChange >= 0 ? styles.positive : styles.negative}
              >
                {result.metrics.trendChange >= 0 ? "+" : ""}
                {formatCurrency(result.metrics.trendChange, "EUR")}
              </strong>
            </span>
            <span>
              <small>Income consistency</small>
              <strong>{percentage(result.metrics.incomeConsistency)}</strong>
            </span>
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Fixed pressure</span>
              <h2>Known commitments</h2>
            </div>
            <strong className={styles.commitmentRatio}>
              {percentage(result.metrics.commitmentRatio)} of expected income
            </strong>
          </header>

          <div className={styles.commitmentSplit}>
            <span>
              <ReceiptText aria-hidden="true" />
              <small>Upcoming bills</small>
              <strong>{formatCurrency(result.commitments.billsTotal, "EUR")}</strong>
            </span>
            <span>
              <ShieldCheck aria-hidden="true" />
              <small>Debt minimums</small>
              <strong>{formatCurrency(result.commitments.debtMinimums, "EUR")}</strong>
            </span>
          </div>

          <div className={styles.commitmentList}>
            {result.commitments.items.length ? (
              result.commitments.items.map((item) => (
                <div className={styles.commitmentRow} key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.category} · {dateLabel(item.dueDate)}</small>
                  </div>
                  <b>{formatCurrency(item.amount, "EUR")}</b>
                </div>
              ))
            ) : (
              <p className={styles.empty}>No known commitments in the next 30 days.</p>
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
                      <b>{formatCurrency(category.recentAmount, "EUR")}</b>
                      <small
                        className={
                          category.changePercent !== null && category.changePercent > 0
                            ? styles.negative
                            : styles.positive
                        }
                      >
                        {category.changePercent === null
                          ? "New pressure"
                          : `${category.changePercent > 0 ? "+" : ""}${category.changePercent.toFixed(0)}% vs prior 90 days`}
                      </small>
                    </div>
                  </div>
                  <div className={styles.categoryTrack} aria-hidden="true">
                    <span style={{ width: `${Math.min(100, category.share * 100)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className={styles.empty}>Expense categories will appear as activity is recorded.</p>
            )}
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Decision support</span>
              <h2>Cash-flow insights</h2>
            </div>
          </header>

          <div className={styles.insightList}>
            {result.insights.map((insight) => {
              const Icon = INSIGHT_ICONS[insight.tone];
              return (
                <div className={styles.insight} data-tone={insight.tone} key={insight.id}>
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

      <article className={styles.nextAction}>
        <Sparkles size={21} aria-hidden="true" />
        <div>
          <span>Next best cash-flow action</span>
          <strong>{result.nextBestAction}</strong>
        </div>
      </article>

      <p className={styles.methodNote}>
        Forecasts are estimates, not bank balances. FICONTER conservatively combines
        current-month activity, recent monthly averages, Monthly Planner targets and
        known commitments. Core income, expense, savings and health values continue
        to come from the existing Financial Health source of truth.
      </p>
    </section>
  );
}
