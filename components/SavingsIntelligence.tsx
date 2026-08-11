"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Layers3,
  Pencil,
  PiggyBank,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import { getExchangeRate } from "@/lib/performance/exchangeRateCache";
import {
  convertToReportingCurrency,
  finiteNumber,
  roundMoney,
  roundRate,
} from "@/lib/finance/money";
import { CURRENCY_CODES, currencyName, currencySymbol, formatReportingCurrency } from "@/lib/financialOptions";
import { useCurrencyDisplay } from "@/components/CurrencyDisplayProvider";
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

type EditableSavingTransaction = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  amount_eur: number;
  exchange_rate_to_eur: number;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
  category: string;
  transaction_date: string;
  occurred_at: string | null;
  type: string;
};

type DeleteSavingTarget = {
  id: string;
  description: string;
};

type RateState = {
  rate: number;
  date: string;
  source: string;
};

const SAVING_CATEGORIES = [
  "General savings",
  "Holiday savings",
  "House deposit",
  "Retirement",
  "Education",
  "Car fund",
  "Other / custom",
] as const;

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

function toLocalDateTimeInput(value: string | null, fallbackDate: string) {
  const date = value ? new Date(value) : new Date(`${fallbackDate}T12:00:00`);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 16);
}

function isGoalManagedSaving(category: string): boolean {
  return category.trim().toLowerCase() === "goal investments";
}

export function SavingsIntelligence({
  userId,
  initialInputs,
  initialError = "",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { baseCurrency } = useCurrencyDisplay();
  const refreshTimerRef = useRef<number | null>(null);
  const [inputs, setInputs] = useState(initialInputs);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [averagePeriod, setAveragePeriod] =
    useState<SavingsAveragePeriod>(6);
  const [editTarget, setEditTarget] =
    useState<EditableSavingTransaction | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<DeleteSavingTarget | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState("EUR");
  const [editCategory, setEditCategory] = useState("General savings");
  const [customEditCategory, setCustomEditCategory] = useState("");
  const [editOccurredAt, setEditOccurredAt] = useState("");
  const [editRate, setEditRate] = useState<RateState>({
    rate: 1,
    date: new Date().toISOString().slice(0, 10),
    source: "identity",
  });
  const [editRateLoading, setEditRateLoading] = useState(false);
  const [editRateError, setEditRateError] = useState("");
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setInputs(initialInputs);
    setError(initialError);
  }, [initialError, initialInputs]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const currencyOptions = useMemo(
    () =>
      CURRENCY_CODES.map((code) => ({
        code,
        symbol: currencySymbol(code),
        name: currencyName(code),
      })).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const visibleSavingCategories = useMemo(() => {
    const values = new Set<string>(SAVING_CATEGORIES);
    if (
      editTarget?.category &&
      !isGoalManagedSaving(editTarget.category) &&
      !values.has(editTarget.category)
    ) {
      values.add(editTarget.category);
    }
    return [...values];
  }, [editTarget]);

  const announceNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice("");
    }, 3200);
  }, []);

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



  useEffect(() => {
    if (!editTarget) return;
    const controller = new AbortController();

    if (editCurrency === "EUR") {
      setEditRate({
        rate: 1,
        date: new Date().toISOString().slice(0, 10),
        source: "identity",
      });
      setEditRateError("");
      setEditRateLoading(false);
      return () => controller.abort();
    }

    async function loadEditRate() {
      setEditRateLoading(true);
      setEditRateError("");
      try {
        const data = await getExchangeRate(editCurrency, "EUR", {
          signal: controller.signal,
        });
        setEditRate({ rate: data.rate, date: data.date, source: data.source });
      } catch (rateFetchError) {
        if ((rateFetchError as Error).name !== "AbortError") {
          setEditRateError((rateFetchError as Error).message);
        }
      } finally {
        if (!controller.signal.aborted) setEditRateLoading(false);
      }
    }

    void loadEditRate();
    return () => controller.abort();
  }, [editCurrency, editTarget]);

  const openEdit = useCallback(
    async (savingId: string) => {
      setActionError("");
      setActionLoading(true);
      const { data, error: transactionError } = await supabase
        .from("transactions")
        .select(
          "id,description,amount,currency,amount_eur,exchange_rate_to_eur,exchange_rate_date,exchange_rate_source,category,transaction_date,occurred_at,type",
        )
        .eq("id", savingId)
        .single();

      if (transactionError || !data) {
        setActionError(
          transactionError?.message ||
            "The saving could not be loaded for editing.",
        );
        setActionLoading(false);
        return;
      }

      if (data.type !== "saving") {
        setActionError("Only saving transactions can be edited here.");
        setActionLoading(false);
        return;
      }

      setEditTarget(data as EditableSavingTransaction);
      setEditDescription(data.description || "");
      setEditAmount(String(finiteNumber(data.amount)));
      setEditCurrency(data.currency || "EUR");
      setEditCategory(data.category || "General savings");
      setCustomEditCategory("");
      setEditOccurredAt(
        toLocalDateTimeInput(data.occurred_at, data.transaction_date),
      );
      setEditRate({
        rate:
          data.currency === "EUR"
            ? 1
            : finiteNumber(data.exchange_rate_to_eur) || 1,
        date:
          data.exchange_rate_date || new Date().toISOString().slice(0, 10),
        source: data.exchange_rate_source || "stored",
      });
      setEditRateError("");
      setActionLoading(false);
    },
    [supabase],
  );

  const requestDelete = useCallback((savingId: string, description: string) => {
    setActionError("");
    setDeleteTarget({ id: savingId, description });
  }, []);

  const saveEditedSaving = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!editTarget || actionLoading) return;

      const finalCategory =
        editCategory === "Other / custom"
          ? customEditCategory.trim()
          : editCategory;

      if (!finalCategory) {
        setActionError("Please enter a custom saving category.");
        return;
      }

      if (isGoalManagedSaving(finalCategory)) {
        setActionError(
          "Goal investments should continue to be managed from Goals.",
        );
        return;
      }

      if (
        editCurrency !== "EUR" &&
        (editRateLoading || editRateError || !editRate.rate)
      ) {
        setActionError(
          "A valid EUR exchange rate is required before saving changes.",
        );
        return;
      }

      const occurred = new Date(editOccurredAt);
      if (Number.isNaN(occurred.getTime())) {
        setActionError("Please choose a valid saving date and time.");
        return;
      }

      const originalAmount = roundMoney(editAmount);
      if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
        setActionError("Please enter a saving amount greater than zero.");
        return;
      }

      const description = editDescription.trim() || "Saving contribution";
      setActionLoading(true);
      setActionError("");

      const update = {
        description,
        amount: roundMoney(originalAmount),
        currency: editCurrency,
        amount_eur: convertToReportingCurrency(originalAmount, editRate.rate),
        exchange_rate_to_eur: roundRate(editRate.rate),
        exchange_rate_date: editRate.date,
        exchange_rate_source: editRate.source,
        type: "saving",
        category: finalCategory,
        transaction_date: editOccurredAt.slice(0, 10),
        occurred_at: occurred.toISOString(),
      };

      const { error: updateError } = await supabase
        .from("transactions")
        .update(update)
        .eq("id", editTarget.id);

      if (updateError) {
        setActionError(updateError.message);
      } else {
        setEditTarget(null);
        await refresh();
        notifyFiconterDataChange("all");
        announceNotice(
          "Saving updated. Transactions and connected summaries were refreshed.",
        );
      }

      setActionLoading(false);
    },
    [
      actionLoading,
      announceNotice,
      customEditCategory,
      editAmount,
      editCategory,
      editCurrency,
      editDescription,
      editOccurredAt,
      editRate,
      editRateError,
      editRateLoading,
      editTarget,
      refresh,
      supabase,
    ],
  );

  const deleteSaving = useCallback(async () => {
    if (!deleteTarget || actionLoading) return;

    setActionLoading(true);
    setActionError("");

    const { error: deleteError } = await supabase.rpc(
      "delete_transactions_with_linked_bills",
      { p_transaction_ids: [deleteTarget.id] },
    );

    if (deleteError) {
      setActionError(deleteError.message);
    } else {
      setDeleteTarget(null);
      await refresh();
      notifyFiconterDataChange("all");
      announceNotice(
        "Saving removed. The linked transaction and connected summaries were refreshed.",
      );
    }

    setActionLoading(false);
  }, [actionLoading, announceNotice, deleteTarget, refresh, supabase]);

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
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {actionError && !editTarget && !deleteTarget ? (
        <div className={styles.error}>{actionError}</div>
      ) : null}

      <div className={styles.metricGrid}>
        <article>
          <PiggyBank aria-hidden="true" />
          <span>Non-emergency savings</span>
          <strong>{formatReportingCurrency(result.metrics.totalSaved)}</strong>
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
              <strong>{formatReportingCurrency(selectedMonthlyAverage)}</strong>
              <small>
                Total saved in the last {averagePeriod} calendar months divided
                by {averagePeriod}. Months without savings count as €0.
              </small>
            </div>
            <div className={styles.annualizedPace}>
              <span>Annualized pace</span>
              <b>{formatReportingCurrency(selectedAnnualizedPace)}</b>
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
                {formatReportingCurrency(result.metrics.recommendedMonthlyTarget)}
              </strong>
            </span>
            <span>
              <small>Monthly gap</small>
              <strong>{formatReportingCurrency(result.metrics.monthlyGap)}</strong>
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
                    title={`${monthLabel(month.month)}: ${formatReportingCurrency(month.savings)}`}
                  />
                </div>
                <strong>{monthLabel(month.month).split(" ")[0]}</strong>
                <small>{formatReportingCurrency(month.savings)}</small>
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
                      <b>{formatReportingCurrency(category.amount)}</b>
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
                  ? formatReportingCurrency(result.bestMonth.amount)
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
                  ? formatReportingCurrency(result.weakestMonth.amount)
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
                {formatReportingCurrency(result.metrics.baselineMonthlySavings)}
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
              {result.recentSavings.map((saving) => {
                const managedInGoals = isGoalManagedSaving(saving.category);
                return (
                  <div className={styles.recentRow} key={saving.id}>
                    <div className={styles.recentIcon}>
                      <PiggyBank size={17} aria-hidden="true" />
                    </div>
                    <div className={styles.recentMeta}>
                      <strong>{saving.description}</strong>
                      <span>
                        {saving.category} · {dateLabel(saving.occurredAt)}
                      </span>
                    </div>
                    <div className={styles.recentRight}>
                      <b>{formatReportingCurrency(saving.amount)}</b>
                      {managedInGoals ? (
                        <Link className={styles.inlineLink} href="/dashboard/goals">
                          Managed in Goals
                        </Link>
                      ) : (
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            onClick={() => void openEdit(saving.id)}
                            disabled={actionLoading}
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className={styles.deleteRowButton}
                            onClick={() => requestDelete(saving.id, saving.description)}
                            disabled={actionLoading}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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

      {editTarget ? (
        <div
          className={styles.backdrop}
          onMouseDown={() => !actionLoading && setEditTarget(null)}
        >
          <div
            className={styles.modal}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              className={styles.close}
              type="button"
              onClick={() => setEditTarget(null)}
            >
              <X size={18} />
            </button>
            <small>SAVINGS ADJUSTMENT</small>
            <h3>Edit saving</h3>
            <p className={styles.fieldNote}>
              This updates the linked transaction in Transactions and refreshes
              Overview, Planner and Savings automatically.
            </p>
            <form className={styles.modalForm} onSubmit={saveEditedSaving}>
              <label>
                Description
                <input
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  required
                />
              </label>
              <div className={styles.modalGrid}>
                <label>
                  Amount
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editAmount}
                    onChange={(event) => setEditAmount(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Currency
                  <select
                    value={editCurrency}
                    onChange={(event) => setEditCurrency(event.target.value)}
                  >
                    {currencyOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.symbol} {option.code} — {option.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.modalGrid}>
                <label>
                  Category
                  <select
                    value={editCategory}
                    onChange={(event) => setEditCategory(event.target.value)}
                  >
                    {visibleSavingCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Exact date and time
                  <input
                    type="datetime-local"
                    value={editOccurredAt}
                    onChange={(event) => setEditOccurredAt(event.target.value)}
                    required
                  />
                </label>
              </div>
              {editCategory === "Other / custom" ? (
                <label>
                  Custom category
                  <input
                    value={customEditCategory}
                    onChange={(event) =>
                      setCustomEditCategory(event.target.value)
                    }
                    required
                  />
                </label>
              ) : null}
              <div className={styles.fxPreview}>
                {editRateLoading
                  ? "Retrieving reference rate…"
                  : editRateError
                    ? editRateError
                    : `Base currency equivalent: ${formatReportingCurrency(convertToReportingCurrency(editAmount, editRate.rate))} · displayed in ${baseCurrency}`}
              </div>
              {actionError ? <div className={styles.error}>{actionError}</div> : null}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setEditTarget(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className={styles.backdrop}
          onMouseDown={() => !actionLoading && setDeleteTarget(null)}
        >
          <div
            className={`${styles.modal} ${styles.smallModal}`}
            onMouseDown={(event) => event.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <button
              className={styles.close}
              type="button"
              onClick={() => setDeleteTarget(null)}
            >
              <X size={18} />
            </button>
            <small>PERMANENT ACTION</small>
            <h3>Remove saving?</h3>
            <p className={styles.fieldNote}>
              “{deleteTarget.description}” will be removed from Savings and the
              linked transaction will be deleted from Transactions at the same
              time.
            </p>
            {actionError ? <div className={styles.error}>{actionError}</div> : null}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setDeleteTarget(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className={styles.dangerButton}
                type="button"
                onClick={() => void deleteSaving()}
                disabled={actionLoading}
              >
                {actionLoading ? "Removing…" : "Remove saving"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
