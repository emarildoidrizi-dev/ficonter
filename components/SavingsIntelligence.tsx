"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Layers3,
  PiggyBank,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/financialOptions";
import {
  calculateSavingsIntelligence,
  normalizeSavingsIntelligenceInputs,
  SAVINGS_AVERAGE_PERIODS,
  type SavingsAveragePeriod,
  type SavingsInsightTone,
  type SavingsIntelligenceInputs,
} from "@/lib/wealth/savingsIntelligence";
import styles from "./SavingsIntelligence.module.css";

type Props = {
  userId: string;
  initialInputs: SavingsIntelligenceInputs;
  initialError?: string;
};

const INSIGHT_ICONS = {
  positive: CheckCircle2,
  info: Activity,
  warning: CircleAlert,
  critical: CircleAlert,
} satisfies Record<SavingsInsightTone, typeof Activity>;

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month || "No month";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
  }).format(new Date(year, monthNumber - 1, 1));
}

function dateLabel(value: string | null): string {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function trendLabel(change: number): string {
  if (change > 0.01) return "Improving";
  if (change < -0.01) return "Slowing";
  return "Stable";
}

export function SavingsIntelligence({
  userId,
  initialInputs,
  initialError = "",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const refreshTimerRef = useRef<number | null>(null);
  const [inputs, setInputs] = useState(initialInputs);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [averagePeriod, setAveragePeriod] =
    useState<SavingsAveragePeriod>(6);

  useEffect(() => {
    setInputs(initialInputs);
    setError(initialError);
  }, [initialError, initialInputs]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const { data, error: refreshError } = await supabase.rpc(
      "get_savings_intelligence_inputs",
    );

    if (refreshError) {
      setError(refreshError.message);
    } else {
      setInputs(normalizeSavingsIntelligenceInputs(data));
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
      .channel(`savings-intelligence:${userId}`)
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

  const result = useMemo(() => calculateSavingsIntelligence(inputs), [inputs]);
  const statusSlug = result.status.toLowerCase().replaceAll(" ", "-");
  const maxMonthlySaving = Math.max(
    1,
    ...result.monthly.map((month) => month.savings),
    result.metrics.recommendedMonthlyTarget,
  );
  const maxCategoryAmount = Math.max(
    1,
    ...result.categories.map((category) => category.amount),
  );
  const targetProgress = Math.min(100, result.metrics.progressToTarget);
  const selectedMonthlyAverage =
    result.metrics.averageMonthlySavingsByPeriod[averagePeriod];
  const selectedAnnualizedPace = selectedMonthlyAverage * 12;

  return (
    <section className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Savings</span>
          <h1>Savings</h1>
          <p>
            See how much you have saved, your recent contributions and your
            monthly progress. Every figure uses the same transactions and
            cash-flow data as the rest of FICONTER.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.primaryAction} href="/dashboard/transactions">
            <PiggyBank size={17} aria-hidden="true" />
            Record saving
          </Link>
          <button
            type="button"
            className={styles.refreshButton}
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw
              className={refreshing ? styles.spinning : ""}
              size={17}
              aria-hidden="true"
            />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.metricGrid}>
        <article>
          <PiggyBank aria-hidden="true" />
          <span>Non-emergency savings</span>
          <strong>{formatCurrency(result.metrics.totalSaved, "EUR")}</strong>
          <small>Emergency Fund contributions are tracked separately</small>
        </article>
        <article>
          <Target aria-hidden="true" />
          <span>Non-emergency savings rate</span>
          <strong>{(result.metrics.savingsRate * 100).toFixed(1)}%</strong>
          <small>Non-emergency savings divided by recorded income</small>
        </article>
        <article className={styles.periodMetric}>
          <div className={styles.periodHeader}>
            <div>
              <Activity aria-hidden="true" />
              <span>Average monthly non-emergency savings</span>
            </div>
            <div
              className={styles.periodSelector}
              role="group"
              aria-label="Choose savings average period"
            >
              {SAVINGS_AVERAGE_PERIODS.map((period) => (
                <button
                  type="button"
                  key={period}
                  data-active={averagePeriod === period}
                  aria-pressed={averagePeriod === period}
                  onClick={() => setAveragePeriod(period)}
                >
                  {period}M
                </button>
              ))}
            </div>
          </div>
          <div className={styles.periodValues} aria-live="polite">
            <div>
              <strong>{formatCurrency(selectedMonthlyAverage, "EUR")}</strong>
              <small>
                Total saved in the last {averagePeriod} calendar months divided
                by {averagePeriod}. Months without savings count as €0.
              </small>
            </div>
            <div className={styles.annualizedPace}>
              <span>Annualized pace</span>
              <b>{formatCurrency(selectedAnnualizedPace, "EUR")}</b>
              <small>Selected monthly average × 12</small>
            </div>
          </div>
        </article>
      </div>

      <article className={styles.rhythm} data-status={statusSlug}>
        <div className={styles.rhythmIcon}>
          <PiggyBank size={28} aria-hidden="true" />
        </div>
        <div className={styles.rhythmBody}>
          <div className={styles.rhythmTop}>
            <div>
              <span>Saving rhythm</span>
              <h2>{result.status}</h2>
            </div>
            <div className={styles.confidence}>
              <small>Savings-history confidence</small>
              <strong>{result.confidence}</strong>
              <span>{result.dataCoverage}% savings-history coverage</span>
            </div>
          </div>
          <p>{result.summary}</p>

          <div className={styles.progressHeader}>
            <span>Progress to target using the six-month average</span>
            <strong>{result.metrics.progressToTarget.toFixed(1)}%</strong>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Savings target progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(targetProgress)}
          >
            <span style={{ width: `${targetProgress}%` }} />
          </div>

          <div className={styles.rhythmMetrics}>
            <span>
              <small>Recommended monthly target</small>
              <strong>
                {formatCurrency(result.metrics.recommendedMonthlyTarget, "EUR")}
              </strong>
            </span>
            <span>
              <small>Monthly gap</small>
              <strong>{formatCurrency(result.metrics.monthlyGap, "EUR")}</strong>
            </span>
            <span>
              <small>Saving consistency</small>
              <strong>{(result.metrics.consistencyRate * 100).toFixed(0)}%</strong>
            </span>
            <span>
              <small>Current streak</small>
              <strong>{result.metrics.currentStreak} months</strong>
            </span>
          </div>
        </div>
      </article>

      <div className={styles.twoColumnWide}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Monthly trend</span>
              <h2>Saving momentum</h2>
              <p>
                Twelve months of existing saving transactions compared with the
                current sustainable monthly recommendation.
              </p>
            </div>
            <div
              className={styles.trendBadge}
              data-direction={
                result.hasSavingsData
                  ? trendLabel(result.metrics.recentTrendChange).toLowerCase()
                  : "waiting"
              }
            >
              {!result.hasSavingsData ? (
                <Activity size={16} aria-hidden="true" />
              ) : result.metrics.recentTrendChange > 0 ? (
                <TrendingUp size={16} aria-hidden="true" />
              ) : result.metrics.recentTrendChange < 0 ? (
                <TrendingDown size={16} aria-hidden="true" />
              ) : (
                <Activity size={16} aria-hidden="true" />
              )}
              {result.hasSavingsData
                ? trendLabel(result.metrics.recentTrendChange)
                : "Waiting for savings"}
            </div>
          </header>

          <div className={styles.chart} role="img" aria-label="Monthly saving contributions for the last twelve months">
            {result.metrics.recommendedMonthlyTarget > 0 ? (
              <div
                className={styles.targetLine}
                style={{
                  bottom: `${Math.min(
                    100,
                    (result.metrics.recommendedMonthlyTarget / maxMonthlySaving) * 100,
                  )}%`,
                }}
              >
                <span>Target</span>
              </div>
            ) : null}
            {result.monthly.map((month) => (
              <div className={styles.chartColumn} key={month.month}>
                <div className={styles.barArea}>
                  <span
                    className={styles.bar}
                    style={{
                      height: `${Math.max(
                        month.savings > 0 ? 4 : 0,
                        (month.savings / maxMonthlySaving) * 100,
                      )}%`,
                    }}
                    title={`${monthLabel(month.month)}: ${formatCurrency(month.savings, "EUR")}`}
                  />
                </div>
                <strong>{monthLabel(month.month).split(" ")[0]}</strong>
                <small>{formatCurrency(month.savings, "EUR")}</small>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Savings allocation</span>
              <h2>Where savings are going</h2>
              <p>
                Categories are derived from existing non-emergency saving
                transactions. Goal investments remain linked to their original
                transactions; Emergency Fund stays in its dedicated module.
              </p>
            </div>
          </header>

          {result.categories.length ? (
            <div className={styles.categoryList}>
              {result.categories.slice(0, 8).map((category) => (
                <div className={styles.categoryRow} key={category.category}>
                  <div className={styles.categoryTop}>
                    <div>
                      <strong>{category.category}</strong>
                      <span>{category.contributionCount} contributions</span>
                    </div>
                    <div>
                      <b>{formatCurrency(category.amount, "EUR")}</b>
                      <span>{(category.share * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className={styles.categoryTrack} aria-hidden="true">
                    <span
                      style={{
                        width: `${Math.max(
                          3,
                          (category.amount / maxCategoryAmount) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Layers3 size={24} aria-hidden="true" />
              <strong>No savings allocation yet</strong>
              <span>Categories appear after non-emergency saving transactions are recorded.</span>
            </div>
          )}
        </article>
      </div>

      <div className={styles.twoColumn}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Saving highlights</span>
              <h2>Consistency and monthly performance</h2>
            </div>
          </header>

          <div className={styles.highlightGrid}>
            <div>
              <BarChart3 size={19} aria-hidden="true" />
              <span>Best month</span>
              <strong>
                {result.bestMonth ? monthLabel(result.bestMonth.month) : "Not available"}
              </strong>
              <small>
                {result.bestMonth
                  ? formatCurrency(result.bestMonth.amount, "EUR")
                  : "Build saving history"}
              </small>
            </div>
            <div>
              <CalendarDays size={19} aria-hidden="true" />
              <span>Weakest month</span>
              <strong>
                {result.weakestMonth
                  ? monthLabel(result.weakestMonth.month)
                  : "Not available"}
              </strong>
              <small>
                {result.weakestMonth
                  ? formatCurrency(result.weakestMonth.amount, "EUR")
                  : "Build saving history"}
              </small>
            </div>
            <div>
              <Activity size={19} aria-hidden="true" />
              <span>Active saving months</span>
              <strong>
                {result.metrics.savingMonths} / {result.metrics.activeMonths}
              </strong>
              <small>Months with savings among active financial months</small>
            </div>
            <div>
              <WalletCards size={19} aria-hidden="true" />
              <span>Planning baseline</span>
              <strong>
                {formatCurrency(result.metrics.baselineMonthlySavings, "EUR")}
              </strong>
              <small>
                Six-month calendar average used for target progress and planning
              </small>
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Recent contributions</span>
              <h2>Latest saving activity</h2>
            </div>
          </header>

          {result.recentSavings.length ? (
            <div className={`${styles.recentList} ficonter-scroll-region`}>
              {result.recentSavings.map((saving) => (
                <div className={styles.recentRow} key={saving.id}>
                  <div className={styles.recentIcon}>
                    <PiggyBank size={17} aria-hidden="true" />
                  </div>
                  <div>
                    <strong>{saving.description}</strong>
                    <span>
                      {saving.category} · {dateLabel(saving.occurredAt)}
                    </span>
                  </div>
                  <b>{formatCurrency(saving.amount, "EUR")}</b>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <PiggyBank size={24} aria-hidden="true" />
              <strong>No saving contributions recorded</strong>
              <span>Use a non-emergency General Saving transaction to start the history.</span>
            </div>
          )}
        </article>
      </div>

      <article className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <span>Summary</span>
            <h2>What your saving pattern is showing</h2>
          </div>
        </header>

        <div className={styles.insightGrid}>
          {result.insights.map((insight) => {
            const Icon = INSIGHT_ICONS[insight.tone];
            return (
              <div className={styles.insight} data-tone={insight.tone} key={insight.id}>
                <div className={styles.insightIcon}>
                  <Icon size={19} aria-hidden="true" />
                </div>
                <div>
                  <strong>{insight.title}</strong>
                  <p>{insight.detail}</p>
                  <span>{insight.action}</span>
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <article className={styles.nextAction}>
        <div className={styles.nextActionIcon}>
          <Sparkles size={22} aria-hidden="true" />
        </div>
        <div>
          <span>Next best action</span>
          <strong>{result.nextBestAction}</strong>
          <p>
            Forecasts are estimates based on recorded history. Savings
            Intelligence excludes Emergency Fund contributions while continuing
            to reuse the existing shared Financial Health and Cash Flow engines.
          </p>
        </div>
      </article>
    </section>
  );
}
