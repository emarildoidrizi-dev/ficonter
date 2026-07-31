"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Check,
  CircleAlert,
  Compass,
  Flag,
  Gauge,
  Landmark,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Umbrella,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/financialOptions";
import {
  calculateFinancialIndependence,
  normalizeFinancialIndependenceInputs,
  type FinancialIndependenceInputs,
  type FinancialIndependenceInsightTone,
} from "@/lib/wealth/financialIndependence";
import styles from "./FinancialIndependence.module.css";

type Props = {
  userId: string;
  initialInputs: FinancialIndependenceInputs;
  initialError?: string;
};

const INSIGHT_ICONS = {
  positive: TrendingUp,
  info: Compass,
  warning: CircleAlert,
  critical: CircleAlert,
} satisfies Record<FinancialIndependenceInsightTone, typeof Compass>;

const WITHDRAWAL_RATES = [3, 3.5, 4, 4.5, 5] as const;
const RETURN_RATES = [0, 2, 4, 6, 8] as const;

function percentage(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

function dateLabel(value: string | null): string {
  if (!value) return "Not available yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function durationLabel(months: number | null): string {
  if (months === null) return "Not available yet";
  if (months === 0) return "Target reached";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (!years) return `${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`;
  if (!remainingMonths) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years}y ${remainingMonths}m`;
}

function parseAmount(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function FinancialIndependence({
  userId,
  initialInputs,
  initialError = "",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const refreshTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const [inputs, setInputs] = useState(initialInputs);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [targetSpending, setTargetSpending] = useState(
    initialInputs.settings.targetMonthlySpending?.toString() ?? "",
  );
  const [withdrawalRate, setWithdrawalRate] = useState(
    initialInputs.settings.withdrawalRate,
  );
  const [returnRate, setReturnRate] = useState(
    initialInputs.settings.annualRealReturnRate,
  );

  useEffect(() => {
    setInputs(initialInputs);
    setError(initialError);
    if (!dirty) {
      setTargetSpending(
        initialInputs.settings.targetMonthlySpending?.toString() ?? "",
      );
      setWithdrawalRate(initialInputs.settings.withdrawalRate);
      setReturnRate(initialInputs.settings.annualRealReturnRate);
    }
  }, [dirty, initialError, initialInputs]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 5000);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const { data, error: refreshError } = await supabase.rpc(
      "get_financial_independence_inputs",
    );

    if (refreshError) {
      setError(refreshError.message);
    } else {
      const normalized = normalizeFinancialIndependenceInputs(data);
      setInputs(normalized);
      setError("");
      if (!dirty) {
        setTargetSpending(
          normalized.settings.targetMonthlySpending?.toString() ?? "",
        );
        setWithdrawalRate(normalized.settings.withdrawalRate);
        setReturnRate(normalized.settings.annualRealReturnRate);
      }
    }
    setRefreshing(false);
  }, [dirty, supabase]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, 220);
  }, [refresh]);

  useEffect(() => {
    const onPlatformChange = () => scheduleRefresh();
    window.addEventListener("ficonter:data-changed", onPlatformChange);
    return () => {
      window.removeEventListener("ficonter:data-changed", onPlatformChange);
    };
  }, [scheduleRefresh]);

  useEffect(() => {
    const update = () => scheduleRefresh();
    const channel = supabase
      .channel(`financial-independence:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${userId}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debts",
          filter: `user_id=eq.${userId}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "debt_payments",
          filter: `user_id=eq.${userId}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bills",
          filter: `user_id=eq.${userId}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "goals",
          filter: `user_id=eq.${userId}`,
        },
        update,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_independence_settings",
          filter: `user_id=eq.${userId}`,
        },
        update,
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
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

  const previewInputs = useMemo<FinancialIndependenceInputs>(
    () => ({
      ...inputs,
      settings: {
        ...inputs.settings,
        targetMonthlySpending: parseAmount(targetSpending),
        withdrawalRate,
        annualRealReturnRate: returnRate,
      },
    }),
    [inputs, returnRate, targetSpending, withdrawalRate],
  );
  const result = useMemo(
    () => calculateFinancialIndependence(previewInputs),
    [previewInputs],
  );

  async function saveAssumptions() {
    const parsedSpending = parseAmount(targetSpending);
    if (targetSpending.trim() && parsedSpending === null) {
      setError("Enter a valid monthly lifestyle amount.");
      return;
    }

    setSaving(true);
    setError("");
    const payload = {
      user_id: userId,
      target_monthly_spending: parsedSpending,
      withdrawal_rate: withdrawalRate,
      annual_real_return_rate: returnRate,
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = await supabase
      .from("financial_independence_settings")
      .upsert(payload, { onConflict: "user_id" });

    if (saveError) {
      setError(saveError.message);
    } else {
      setInputs((current) => ({
        ...current,
        settings: {
          targetMonthlySpending: parsedSpending,
          withdrawalRate,
          annualRealReturnRate: returnRate,
          updatedAt: payload.updated_at,
        },
      }));
      setDirty(false);
      showNotice("Financial Independence assumptions saved.");
    }
    setSaving(false);
  }

  function useCurrentExpenses() {
    setTargetSpending("");
    setDirty(true);
  }

  const stageSlug = result.stage.toLowerCase().replaceAll(" ", "-");
  const nextActionDestination =
    result.stage === "Debt-clearing"
      ? { href: "/dashboard/debt", label: "Review debt" }
      : result.sources.emergency.metrics.coverageMonths < 3
        ? { href: "/dashboard/emergency-fund", label: "Review emergency fund" }
        : { href: "/dashboard/savings", label: "Review savings intelligence" };

  return (
    <section className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Wealth Engine</span>
          <h1>Financial independence</h1>
          <p>
            Turn your existing Net Worth, Savings, Emergency Fund and cash-flow
            records into one transparent path toward a work-optional financial
            position. No second balance or parallel calculation is created.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.secondaryAction} href="/dashboard/net-worth">
            <Landmark size={17} aria-hidden="true" />
            Net worth
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

      {notice ? (
        <div className={styles.notice} role="status">
          <Check size={17} aria-hidden="true" />
          {notice}
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.metricGrid}>
        <article>
          <Target aria-hidden="true" />
          <span>Independence target</span>
          <strong>
            {formatCurrency(result.metrics.financialIndependenceTarget, "EUR")}
          </strong>
          <small>
            {formatCurrency(result.assumptions.targetMonthlySpending, "EUR")} per
            month at {result.assumptions.withdrawalRate.toFixed(1)}%
          </small>
        </article>
        <article>
          <WalletCards aria-hidden="true" />
          <span>Investable FI capital</span>
          <strong>{formatCurrency(result.metrics.investableCapital, "EUR")}</strong>
          <small>Net wealth after protected emergency reserve</small>
        </article>
        <article>
          <Gauge aria-hidden="true" />
          <span>Target progress</span>
          <strong>{percentage(result.metrics.progress)}</strong>
          <small>
            {result.metrics.foundationGap > 0
              ? `${formatCurrency(result.metrics.foundationGap, "EUR")} to reach a zero investable baseline`
              : "Progress toward the selected long-term target"}
          </small>
        </article>
        <article>
          <CalendarClock aria-hidden="true" />
          <span>Directional timeline</span>
          <strong>{durationLabel(result.metrics.monthsToTarget)}</strong>
          <small>{dateLabel(result.metrics.estimatedIndependenceDate)}</small>
        </article>
      </div>

      <article className={styles.hero} data-stage={stageSlug}>
        <div className={styles.heroIcon}>
          <Flag size={28} aria-hidden="true" />
        </div>
        <div className={styles.heroBody}>
          <div className={styles.heroTop}>
            <div>
              <span>Independence stage</span>
              <h2>{result.stage}</h2>
            </div>
            <div className={styles.confidence}>
              <small>Planning-data confidence</small>
              <strong>{result.confidence}</strong>
              <span>{result.dataCoverage}% planning-data coverage</span>
            </div>
          </div>
          <p>{result.summary}</p>
          <div className={styles.progressTrack} aria-label="Financial independence progress">
            <span style={{
              width:
                result.metrics.progress > 0
                  ? `${Math.max(1, result.metrics.progress)}%`
                  : "0%",
            }} />
          </div>
          <div className={styles.heroMetrics}>
            <div>
              <small>Monthly wealth-building pace</small>
              <strong>
                {formatCurrency(result.metrics.monthlyWealthContribution, "EUR")}
              </strong>
            </div>
            <div>
              <small>Freedom income today</small>
              <strong>
                {formatCurrency(result.metrics.monthlyFreedomIncome, "EUR")}
              </strong>
            </div>
            <div>
              <small>Protected emergency reserve</small>
              <strong>
                {formatCurrency(result.metrics.protectedEmergencyReserve, "EUR")}
              </strong>
            </div>
            <div>
              <small>Readiness checks</small>
              <strong>{result.metrics.readinessScore} / 5</strong>
            </div>
          </div>
        </div>
      </article>

      <div className={styles.twoColumn}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Planning assumptions</span>
              <h2>Define the life you want to fund</h2>
            </div>
            <ShieldCheck size={24} aria-hidden="true" />
          </div>
          <p className={styles.panelIntro}>
            These are private planning assumptions, not additional financial
            balances. The target updates instantly while you edit them.
          </p>

          <div className={styles.formGrid}>
            <label className={styles.spendingField}>
              <span>Target monthly lifestyle</span>
              <div className={styles.amountInput}>
                <span>€</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={targetSpending}
                  placeholder={result.sources.savings.cashFlow.health.metrics.averageMonthlyExpenses.toFixed(2)}
                  onChange={(event) => {
                    setTargetSpending(event.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <small>
                Leave blank to reuse the current average monthly expense figure.
              </small>
              <button type="button" onClick={useCurrentExpenses}>
                Use current expenses
              </button>
            </label>

            <fieldset>
              <legend>Withdrawal assumption</legend>
              <div className={styles.segmentedControl}>
                {WITHDRAWAL_RATES.map((rate) => (
                  <button
                    type="button"
                    key={rate}
                    data-active={withdrawalRate === rate}
                    onClick={() => {
                      setWithdrawalRate(rate);
                      setDirty(true);
                    }}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
              <small>Lower rates create a larger planning target.</small>
            </fieldset>

            <fieldset>
              <legend>Projected annual real growth</legend>
              <div className={styles.segmentedControl}>
                {RETURN_RATES.map((rate) => (
                  <button
                    type="button"
                    key={rate}
                    data-active={returnRate === rate}
                    onClick={() => {
                      setReturnRate(rate);
                      setDirty(true);
                    }}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
              <small>Used only for the directional timeline.</small>
            </fieldset>
          </div>

          <div className={styles.assumptionSummary}>
            <div>
              <small>Annual lifestyle target</small>
              <strong>
                {formatCurrency(result.metrics.annualTargetSpending, "EUR")}
              </strong>
            </div>
            <div>
              <small>Selected FI target</small>
              <strong>
                {formatCurrency(result.metrics.financialIndependenceTarget, "EUR")}
              </strong>
            </div>
            <button
              type="button"
              className={styles.saveButton}
              disabled={saving || !dirty}
              onClick={() => void saveAssumptions()}
            >
              <Save size={17} aria-hidden="true" />
              {saving ? "Saving…" : "Save assumptions"}
            </button>
          </div>
          <p className={styles.disclaimer}>
            Financial Independence projections are planning estimates. They do
            not guarantee investment returns, future spending, tax outcomes or a
            specific retirement date.
          </p>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Readiness foundation</span>
              <h2>What must be stable first</h2>
            </div>
            <Umbrella size={24} aria-hidden="true" />
          </div>
          <div className={styles.readinessList}>
            {result.readiness.map((item) => (
              <div key={item.id} data-complete={item.complete}>
                <span className={styles.readinessIcon}>
                  {item.complete ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <CircleAlert size={16} aria-hidden="true" />
                  )}
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span>Capital milestones</span>
            <h2>The path in clear stages</h2>
          </div>
          <Target size={24} aria-hidden="true" />
        </div>
        {result.milestones.length ? (
          <div className={styles.milestoneGrid}>
            {result.milestones.map((milestone) => (
              <div key={milestone.percentage} data-reached={milestone.reached}>
                <span>{milestone.percentage}%</span>
                <strong>{milestone.label}</strong>
                <small>{formatCurrency(milestone.amount, "EUR")}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.disclaimer}>
            Enter a monthly lifestyle target or use the current protection baseline to activate capital milestones.
          </p>
        )}
      </article>

      <div className={styles.twoColumn}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Contribution scenarios</span>
              <h2>What changes the timeline</h2>
            </div>
            <TrendingUp size={24} aria-hidden="true" />
          </div>
          <div className={styles.scenarioList}>
            {result.scenarios.map((item) => (
              <div key={item.id} data-primary={item.id === "current"}>
                <div>
                  <strong>{item.label}</strong>
                  <small>
                    {formatCurrency(item.monthlyContribution, "EUR")} monthly
                  </small>
                </div>
                <div>
                  <strong>{durationLabel(item.monthsToTarget)}</strong>
                  <small>
                    {item.yearsSaved && item.yearsSaved > 0
                      ? `${item.yearsSaved} years sooner`
                      : dateLabel(item.estimatedDate)}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.nextAction}>
          <div className={styles.nextActionIcon}>
            <Sparkles size={23} aria-hidden="true" />
          </div>
          <div>
            <span>Next best action</span>
            <h2>{result.nextBestAction}</h2>
            <Link href={nextActionDestination.href}>
              {nextActionDestination.label}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </article>
      </div>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span>Transparent intelligence</span>
            <h2>How FICONTER reads your path</h2>
          </div>
          <Activity size={24} aria-hidden="true" />
        </div>
        <div className={styles.insightGrid}>
          {result.insights.map((insight) => {
            const Icon = INSIGHT_ICONS[insight.tone];
            return (
              <div key={insight.id} data-tone={insight.tone}>
                <span className={styles.insightIcon}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div>
                  <strong>{insight.title}</strong>
                  <p>{insight.description}</p>
                  <small>{insight.action}</small>
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}
