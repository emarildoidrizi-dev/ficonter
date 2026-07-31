"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Umbrella,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  AVERAGE_PERIODS,
  type AveragePeriod,
} from "@/lib/wealth/averagePeriods";
import { formatCurrency } from "@/lib/financialOptions";
import {
  calculateEmergencyFund,
  normalizeEmergencyFundInputs,
  type EmergencyFundInputs,
  type EmergencyFundInsightTone,
} from "@/lib/wealth/emergencyFund";
import styles from "./EmergencyFundIntelligence.module.css";

type Props = {
  userId: string;
  initialInputs: EmergencyFundInputs;
  initialError?: string;
};

const INSIGHT_ICONS = {
  positive: CheckCircle2,
  info: Activity,
  warning: CircleAlert,
  critical: CircleAlert,
} satisfies Record<EmergencyFundInsightTone, typeof Activity>;

function monthLabelParts(month: string): { month: string; year: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) {
    return { month, year: "" };
  }

  return {
    month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(
      new Date(year, monthNumber - 1, 1),
    ),
    year: String(year),
  };
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

function dateTimeLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function EmergencyFundIntelligence({
  userId,
  initialInputs,
  initialError = "",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const refreshTimerRef = useRef<number | null>(null);
  const historyScrollRef = useRef<HTMLDivElement | null>(null);
  const [inputs, setInputs] = useState(initialInputs);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [averagePeriod, setAveragePeriod] = useState<AveragePeriod>(6);

  useEffect(() => {
    setInputs(initialInputs);
    setError(initialError);
  }, [initialError, initialInputs]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const { data, error: refreshError } = await supabase.rpc(
      "get_emergency_fund_intelligence_inputs",
    );

    if (refreshError) {
      setError(refreshError.message);
    } else {
      setInputs(normalizeEmergencyFundInputs(data));
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
      .channel(`emergency-fund-intelligence:${userId}`)
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

  const result = useMemo(() => calculateEmergencyFund(inputs), [inputs]);
  const statusSlug = result.status.toLowerCase().replaceAll(" ", "-");
  const maxMonthlyContribution = Math.max(
    1,
    ...result.monthly.map((month) => month.contribution),
  );
  const selectedAverageContribution =
    result.metrics.averageContributions[averagePeriod];
  const selectedPeriodTotal = selectedAverageContribution * averagePeriod;

  const scrollHistory = useCallback((direction: "earlier" | "later") => {
    const viewport = historyScrollRef.current;
    if (!viewport) return;

    viewport.scrollBy({
      left:
        direction === "earlier"
          ? -Math.max(320, viewport.clientWidth * 0.78)
          : Math.max(320, viewport.clientWidth * 0.78),
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const viewport = historyScrollRef.current;
    if (!viewport) return;

    const frame = window.requestAnimationFrame(() => {
      viewport.scrollLeft = viewport.scrollWidth;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [result.monthly.length]);

  return (
    <section className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Wealth Engine</span>
          <h1>Emergency fund</h1>
          <p>
            Measure financial protection using the same Emergency fund savings,
            income and expense records already used by FICONTER. No second
            balance or duplicate savings calculation is created.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.primaryAction} href="/dashboard/transactions">
            <PiggyBank size={17} aria-hidden="true" />
            Record emergency saving
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
          <Umbrella aria-hidden="true" />
          <span>Current reserve</span>
          <strong>{formatCurrency(result.metrics.currentBalance, "EUR")}</strong>
          <small>Recorded Emergency fund saving transactions</small>
        </article>
        <article>
          <ShieldCheck aria-hidden="true" />
          <span>Months protected</span>
          <strong>{result.metrics.coverageMonths.toFixed(1)} months</strong>
          <small>Based on your monthly protection baseline</small>
        </article>
        <article>
          <Target aria-hidden="true" />
          <span>Recommended reserve</span>
          <strong>{formatCurrency(result.metrics.recommendedTarget, "EUR")}</strong>
          <small>{result.recommendedTargetMonths}-month protection target</small>
        </article>
        <article>
          <WalletCards aria-hidden="true" />
          <span>Remaining gap</span>
          <strong>{formatCurrency(result.metrics.recommendedGap, "EUR")}</strong>
          <small>Amount remaining to the recommended target</small>
        </article>
      </div>

      <article className={styles.readiness} data-status={statusSlug}>
        <div className={styles.readinessIcon}>
          <Umbrella size={28} aria-hidden="true" />
        </div>
        <div className={styles.readinessBody}>
          <div className={styles.readinessTop}>
            <div>
              <span>Reserve readiness</span>
              <h2>{result.status}</h2>
            </div>
            <div className={styles.confidence}>
              <small>Reserve-data confidence</small>
              <strong>{result.confidence}</strong>
              <span>{result.dataCoverage}% reserve-data coverage</span>
            </div>
          </div>
          <p>{result.summary}</p>

          <div className={styles.progressHeader}>
            <span>
              Progress to {result.recommendedTargetMonths}-month recommendation
            </span>
            <strong>{result.metrics.recommendedProgress.toFixed(1)}%</strong>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Emergency fund progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(result.metrics.recommendedProgress)}
          >
            <span
              style={{
                width: `${Math.min(100, result.metrics.recommendedProgress)}%`,
              }}
            />
          </div>

          <div className={styles.readinessMetrics}>
            <span>
              <small>Monthly protection baseline</small>
              <strong>
                {formatCurrency(result.metrics.protectionBaseline, "EUR")}
              </strong>
              <span className={styles.periodMetricNote}>
                Higher of recorded average expenses and known one-month commitments.
              </span>
            </span>
            <span>
              <small>Income stability</small>
              <strong>{result.metrics.incomeStability.toFixed(0)}%</strong>
            </span>
            <span>
              <small>This month contributed</small>
              <strong>
                {formatCurrency(
                  result.metrics.currentMonthContribution,
                  "EUR",
                )}
              </strong>
            </span>
            <div className={styles.periodMetric}>
              <div className={styles.periodMetricTop}>
                <small>Average monthly emergency saving</small>
                <div
                  className={styles.periodSelector}
                  aria-label="Emergency fund average period"
                >
                  {AVERAGE_PERIODS.map((period) => (
                    <button
                      key={period}
                      type="button"
                      data-active={averagePeriod === period}
                      aria-pressed={averagePeriod === period}
                      onClick={() => setAveragePeriod(period)}
                    >
                      {period}M
                    </button>
                  ))}
                </div>
              </div>
              <strong>{formatCurrency(selectedAverageContribution, "EUR")}</strong>
              <span className={styles.periodMetricNote}>
                {formatCurrency(selectedPeriodTotal, "EUR")} contributed over the
                last {averagePeriod} calendar months. Months without a contribution
                count as €0.
              </span>
            </div>
          </div>
        </div>
      </article>

      <div className={styles.twoColumn}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Protection milestones</span>
              <h2>Build the reserve in clear stages</h2>
              <p>
                Every target uses one transparent protection baseline: the higher
                of recorded average expenses and known one-month commitments.
              </p>
            </div>
          </header>

          <div className={styles.milestones}>
            {result.milestones.map((milestone) => (
              <div
                className={styles.milestone}
                data-reached={milestone.reached}
                key={milestone.months}
              >
                <div className={styles.milestoneIcon}>
                  {milestone.reached ? (
                    <CheckCircle2 size={19} aria-hidden="true" />
                  ) : (
                    <ShieldCheck size={19} aria-hidden="true" />
                  )}
                </div>
                <div className={styles.milestoneBody}>
                  <div className={styles.milestoneTop}>
                    <div>
                      <strong>{milestone.label}</strong>
                      <span>{milestone.months} months of expenses</span>
                    </div>
                    <b>{formatCurrency(milestone.target, "EUR")}</b>
                  </div>
                  <div className={styles.miniTrack} aria-hidden="true">
                    <span style={{ width: `${milestone.progress * 100}%` }} />
                  </div>
                  <small>
                    {milestone.reached
                      ? "Milestone reached"
                      : `${formatCurrency(milestone.remaining, "EUR")} remaining`}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Contribution plan</span>
              <h2>A sustainable next step</h2>
            </div>
          </header>

          <div className={styles.planValue}>
            <PiggyBank size={23} aria-hidden="true" />
            <div>
              <span>Suggested monthly contribution</span>
              <strong>
                {formatCurrency(
                  result.metrics.suggestedMonthlyContribution,
                  "EUR",
                )}
              </strong>
            </div>
          </div>

          <div className={styles.planRows}>
            <div>
              <span>Estimated completion</span>
              <strong>
                {result.metrics.recommendedGap <= 0
                  ? "Target reached"
                  : dateLabel(result.metrics.estimatedCompletionDate)}
              </strong>
            </div>
            <div>
              <span>Estimated months remaining</span>
              <strong>
                {result.metrics.monthsToRecommendedTarget === null
                  ? "Build monthly surplus first"
                  : result.metrics.monthsToRecommendedTarget === 0
                    ? "0 months"
                    : `${result.metrics.monthsToRecommendedTarget} months`}
              </strong>
            </div>
            <div>
              <span>Six-month contribution average</span>
              <strong>
                {formatCurrency(
                  result.metrics.averageContribution6Months,
                  "EUR",
                )}
              </strong>
            </div>
          </div>

          <div className={styles.planNote}>
            <CircleAlert size={17} aria-hidden="true" />
            <p>
              The suggestion is capped by your existing income, expense and
              recent contribution data. It is guidance, not a new scheduled
              transaction.
            </p>
          </div>
        </article>
      </div>

      <div className={styles.twoColumnWide}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Contribution history</span>
              <h2>Full monthly history</h2>
              <p className={styles.historyHint}>
                Swipe, use the trackpad, or use the arrows to review earlier months and years.
              </p>
            </div>
            <div className={styles.historyControls}>
              <button
                type="button"
                onClick={() => scrollHistory("earlier")}
                aria-label="Show earlier contribution months"
                title="Earlier months"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollHistory("later")}
                aria-label="Show later contribution months"
                title="Later months"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div
            className={styles.chartViewport}
            ref={historyScrollRef}
            tabIndex={0}
            aria-label="Emergency fund contribution history by month"
          >
            <div className={styles.chart}>
            {result.monthly.map((month) => {
              const height =
                month.contribution > 0
                  ? Math.max(
                      7,
                      (month.contribution / maxMonthlyContribution) * 100,
                    )
                  : 0;
              const label = monthLabelParts(month.month);

              return (
                <div className={styles.chartColumn} key={month.month}>
                  <div className={styles.barArea}>
                    <span
                      className={styles.bar}
                      style={{ height: `${height}%` }}
                      title={`${label.month}${label.year ? ` ${label.year}` : ""}: ${formatCurrency(
                        month.contribution,
                        "EUR",
                      )}`}
                    />
                  </div>
                  <strong>{label.month}</strong>
                  {label.year ? (
                    <span className={styles.chartYear}>{label.year}</span>
                  ) : null}
                  <small>
                    {month.contribution > 0
                      ? formatCurrency(month.contribution, "EUR")
                      : "—"}
                  </small>
                </div>
              );
            })}
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>Recent reserve activity</span>
              <h2>Emergency fund savings</h2>
            </div>
          </header>

          <div className={styles.contributionList}>
            {result.recentContributions.length ? (
              result.recentContributions.slice(0, 6).map((contribution) => (
                <div className={styles.contributionRow} key={contribution.id}>
                  <div>
                    <strong>{contribution.description}</strong>
                    <span>{dateTimeLabel(contribution.occurredAt)}</span>
                  </div>
                  <b>{formatCurrency(contribution.amount, "EUR")}</b>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                <PiggyBank size={24} aria-hidden="true" />
                <strong>No emergency savings recorded</strong>
                <p>
                  Add a General Saving transaction and choose Emergency fund as
                  the category.
                </p>
              </div>
            )}
          </div>
        </article>
      </div>

      <article className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <span>Reserve intelligence</span>
            <h2>What FICONTER sees</h2>
          </div>
        </header>

        <div className={styles.insightGrid}>
          {result.insights.map((insight) => {
            const Icon = INSIGHT_ICONS[insight.tone];
            return (
              <div
                className={styles.insight}
                data-tone={insight.tone}
                key={insight.id}
              >
                <Icon size={20} aria-hidden="true" />
                <div>
                  <strong>{insight.title}</strong>
                  <p>{insight.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <div className={styles.nextAction}>
        <Sparkles size={21} aria-hidden="true" />
        <div>
          <span>Next best action</span>
          <strong>{result.nextBestAction}</strong>
        </div>
        <Link href="/dashboard/transactions">
          Open Transactions
          <TrendingUp size={16} aria-hidden="true" />
        </Link>
      </div>

      <p className={styles.sourceNote}>
        <CalendarClock size={15} aria-hidden="true" />
        Targets update automatically when your recorded income, expenses or
        Emergency fund savings change.
      </p>
    </section>
  );
}
