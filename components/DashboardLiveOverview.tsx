"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  isFinancialDataScope,
  parseFiconterDataChange,
  subscribeFiconterDataChanges,
} from "@/lib/ficonterRealtime";
import {
  reconcileAiInsightsInputs,
  reconcileFinancialHealthInputs,
} from "@/lib/finance/monthlyCashActuals";
import { formatCurrency, formatReportingCurrency } from "@/lib/financialOptions";
import { useCurrencyDisplay, useHistoricalReportingRates } from "@/components/CurrencyDisplayProvider";
import { finiteNumber } from "@/lib/finance/money";
import { calculateBaseCurrencyCashActuals, originalAmountInBaseCurrency } from "@/lib/finance/baseCurrencyActuals";
import {
  calculateFinancialHealth,
  normalizeFinancialHealthInputs,
  type FinancialHealthInputs,
} from "@/lib/wealth/financialHealth";
import { FinancialHealthScore } from "@/components/FinancialHealthScore";
import { FinancialSetupSummary } from "@/components/FinancialSetupSummary";
import { FinancialGpsSummary } from "@/components/FinancialGpsSummary";
import { HorizonCommandStrip } from "@/components/HorizonCommandStrip";
import { HorizonOverviewBoard } from "@/components/HorizonOverviewBoard";
import { FinancialJourneyRail } from "@/components/FinancialJourneyRail";
import type { SetupAcknowledgements } from "@/lib/wealth/setupReadiness";
import {
  normalizeAiInsightsInputs,
  type AiInsightsInputs,
} from "@/lib/wealth/aiInsights";
import { calculateFinancialGps } from "@/lib/wealth/financialGps";
import styles from "./DashboardLiveOverview.module.css";

type Transaction = {
  id: string;
  user_id?: string;
  description: string;
  amount: number | string;
  currency: string | null;
  amount_eur: number | string | null;
  exchange_rate_to_eur?: number | string | null;
  exchange_rate_date?: string | null;
  type: string;
  category: string;
  transaction_date: string;
  occurred_at: string | null;
  created_at?: string | null;
};
type Bill = {
  id: string;
  status: string;
  amount: number | string;
  currency: string | null;
  amount_eur: number | string;
  due_date: string;
  paid_at: string | null;
  transaction_id: string | null;
};

type Props = {
  userId: string;
  name: string;
  initialTransactions: Transaction[];
  initialBills: Bill[];
  initialHealthInputs: FinancialHealthInputs;
  initialSetupAcknowledgements: SetupAcknowledgements;
  initialGpsInputs: AiInsightsInputs;
  initialError?: string;
  initialHealthError?: string;
  initialGpsError?: string;
};

function euroValue(transaction: Transaction) {
  if (transaction.amount_eur !== null && transaction.amount_eur !== undefined) {
    return finiteNumber(transaction.amount_eur);
  }
  return transaction.currency === "EUR" || !transaction.currency
    ? finiteNumber(transaction.amount)
    : 0;
}

function isIncome(transaction: Transaction) {
  return transaction.type === "income";
}

const transactionDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

function readableDateTime(transaction: Transaction) {
  const value =
    transaction.occurred_at ??
    transaction.created_at ??
    `${transaction.transaction_date}T00:00:00`;
  const date = new Date(value);
  return transactionDateTimeFormatter.format(date);
}

function newestFirst(a: Transaction, b: Transaction) {
  const aTime = new Date(
    a.occurred_at ?? a.created_at ?? `${a.transaction_date}T00:00:00`,
  ).getTime();
  const bTime = new Date(
    b.occurred_at ?? b.created_at ?? `${b.transaction_date}T00:00:00`,
  ).getTime();
  return bTime - aTime;
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DashboardLiveOverview({
  userId,
  name,
  initialTransactions,
  initialBills,
  initialHealthInputs,
  initialSetupAcknowledgements,
  initialGpsInputs,
  initialError = "",
  initialHealthError = "",
  initialGpsError = "",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const refreshTimerRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const refreshQueuedRef = useRef(false);
  const [transactions, setTransactions] = useState(
    [...initialTransactions].sort(newestFirst),
  );
  const { baseCurrency } = useCurrencyDisplay();
  const [bills, setBills] = useState(initialBills);
  const historicalDates = useMemo(
    () => [
      ...transactions.map((transaction) => transaction.transaction_date),
      ...bills.map((bill) => bill.paid_at?.slice(0, 10) ?? bill.due_date),
    ],
    [bills, transactions],
  );
  const { rateForDate } = useHistoricalReportingRates(historicalDates);
  const [healthInputs, setHealthInputs] = useState(initialHealthInputs);
  const [healthError, setHealthError] = useState(initialHealthError);
  const [gpsInputs, setGpsInputs] = useState(initialGpsInputs);
  const [gpsError, setGpsError] = useState(initialGpsError);
  const [setupAcknowledgements, setSetupAcknowledgements] = useState(
    initialSetupAcknowledgements,
  );
  const [connectionState, setConnectionState] = useState<
    "connecting" | "live" | "offline"
  >("connecting");
  const [greeting, setGreeting] = useState("Hello");
  const [todayKey, setTodayKey] = useState("");

  useEffect(() => {
    const updateClockContext = () => {
      const now = new Date();
      setGreeting(greetingForHour(now.getHours()));
      setTodayKey(localDateKey(now));
    };
    updateClockContext();
    const timer = window.setInterval(updateClockContext, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setTransactions([...initialTransactions].sort(newestFirst));
  }, [initialTransactions]);
  useEffect(() => {
    setBills(initialBills);
  }, [initialBills]);

  useEffect(() => {
    setHealthInputs(initialHealthInputs);
    setHealthError(initialHealthError);
  }, [initialHealthInputs, initialHealthError]);

  useEffect(() => {
    setGpsInputs(initialGpsInputs);
    setGpsError(initialGpsError);
  }, [initialGpsInputs, initialGpsError]);

  useEffect(() => {
    setSetupAcknowledgements(initialSetupAcknowledgements);
  }, [initialSetupAcknowledgements]);

  const refreshWealthInputs = useCallback(async () => {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return refreshInFlightRef.current;
    }

    const request = (async () => {
      do {
        refreshQueuedRef.current = false;
        const [
          transactionResult,
          billResult,
          healthResult,
          gpsResult,
        ] = await Promise.all([
          supabase
            .from("transactions")
            .select(
              "id,user_id,description,amount,currency,amount_eur,exchange_rate_to_eur,exchange_rate_date,type,category,transaction_date,occurred_at,created_at",
            )
            .eq("user_id", userId)
            .order("occurred_at", { ascending: false }),
          supabase
            .from("bills")
            .select("id,status,amount,currency,amount_eur,due_date,paid_at,transaction_id")
            .eq("user_id", userId),
          supabase.rpc("get_financial_health_inputs"),
          supabase.rpc("get_ai_insights_inputs"),
        ]);

        const nextTransactions = (transactionResult.data ?? []) as Transaction[];
        const nextBills = (billResult.data ?? []) as Bill[];
        const dataError = transactionResult.error ?? billResult.error;

        if (dataError) {
          setHealthError(dataError.message);
        } else {
          setTransactions([...nextTransactions].sort(newestFirst));
          setBills(nextBills);
        }

        if (healthResult.error) {
          setHealthError(healthResult.error.message);
        } else if (!dataError) {
          setHealthInputs(
            reconcileFinancialHealthInputs(
              normalizeFinancialHealthInputs(healthResult.data),
              nextTransactions,
              nextBills,
            ),
          );
          setHealthError("");
        }

        if (gpsResult.error) {
          setGpsError(gpsResult.error.message);
        } else if (!dataError) {
          setGpsInputs(
            reconcileAiInsightsInputs(
              normalizeAiInsightsInputs(gpsResult.data),
              nextTransactions,
              nextBills,
            ),
          );
          setGpsError("");
        }
      } while (refreshQueuedRef.current);
    })();

    refreshInFlightRef.current = request;
    try {
      await request;
    } finally {
      refreshInFlightRef.current = null;
    }
  }, [supabase, userId]);

  const scheduleHealthRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshWealthInputs();
    }, 180);
  }, [refreshWealthInputs]);

  useEffect(() => {
    function upsert(event: Event) {
      const transaction = (event as CustomEvent<Transaction>).detail;
      if (!transaction?.id) return;
      setTransactions((current) =>
        [
          transaction,
          ...current.filter((item) => item.id !== transaction.id),
        ].sort(newestFirst),
      );
      scheduleHealthRefresh();
    }

    function remove(event: Event) {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!id) return;
      setTransactions((current) => current.filter((item) => item.id !== id));
      scheduleHealthRefresh();
    }

    function refreshFromPlatformEvent(event: Event) {
      const change = parseFiconterDataChange(
        (event as CustomEvent<unknown>).detail,
      );
      if (change?.scope === "profile" || change?.scope === "settings") return;
      scheduleHealthRefresh();
    }

    function updateSetup(event: Event) {
      const detail = (event as CustomEvent<SetupAcknowledgements>).detail;
      if (detail) setSetupAcknowledgements(detail);
    }

    window.addEventListener("ficonter:transaction-created", upsert);
    window.addEventListener("ficonter:transaction-upserted", upsert);
    window.addEventListener("ficonter:transaction-deleted", remove);
    window.addEventListener("ficonter:transaction-save-failed", remove);
    window.addEventListener("ficonter:data-changed", refreshFromPlatformEvent);
    window.addEventListener("ficonter:setup-updated", updateSetup);

    return () => {
      window.removeEventListener("ficonter:transaction-created", upsert);
      window.removeEventListener("ficonter:transaction-upserted", upsert);
      window.removeEventListener("ficonter:transaction-deleted", remove);
      window.removeEventListener("ficonter:transaction-save-failed", remove);
      window.removeEventListener(
        "ficonter:data-changed",
        refreshFromPlatformEvent,
      );
      window.removeEventListener("ficonter:setup-updated", updateSetup);
    };
  }, [scheduleHealthRefresh]);

  useEffect(() => {
    if (!userId) return;

    const refreshOnly = () => scheduleHealthRefresh();
    const channel = supabase
      .channel(`dashboard-wealth-engine-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setTransactions((current) => {
            if (payload.eventType === "DELETE") {
              const deletedId = (payload.old as { id?: string }).id;
              return current.filter((item) => item.id !== deletedId);
            }

            const next = payload.new as Transaction;
            if (!next?.id) return current;
            return [
              next,
              ...current.filter((item) => item.id !== next.id),
            ].sort(newestFirst);
          });
          scheduleHealthRefresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bills",
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
          table: "goals",
          filter: `user_id=eq.${userId}`,
        },
        refreshOnly,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monthly_budget_plans",
          filter: `user_id=eq.${userId}`,
        },
        refreshOnly,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monthly_budget_items",
          filter: `user_id=eq.${userId}`,
        },
        refreshOnly,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnectionState("live");
        else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setConnectionState("offline");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scheduleHealthRefresh, supabase, userId]);

  useEffect(() => {
    const unsubscribe = subscribeFiconterDataChanges((change) => {
      if (isFinancialDataScope(change.scope)) scheduleHealthRefresh();
    });
    const handleFocus = () => scheduleHealthRefresh();
    const handleOnline = () => scheduleHealthRefresh();
    const handleVisible = () => {
      if (document.visibilityState === "visible") scheduleHealthRefresh();
    };
    const safetyTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") scheduleHealthRefresh();
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
  }, [scheduleHealthRefresh]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    },
    [],
  );

  const financialHealth = useMemo(
    () => calculateFinancialHealth(healthInputs),
    [healthInputs],
  );
  const recent = useMemo(() => transactions.slice(0, 120), [transactions]);
  const recordedActivity = useMemo(
    () => recent.filter((transaction) => !todayKey || transaction.transaction_date <= todayKey),
    [recent, todayKey],
  );
  const { metrics } = financialHealth;
  const displayActuals = useMemo(
    () =>
      calculateBaseCurrencyCashActuals({
        transactions,
        bills,
        baseCurrency,
        throughDate: todayKey || localDateKey(),
        rateForDate,
      }),
    [baseCurrency, bills, rateForDate, todayKey, transactions],
  );
  const displaySavingsRate =
    displayActuals.totalIncome > 0
      ? (displayActuals.totalSavings / displayActuals.totalIncome) * 100
      : 0;

  const displayedTransactionAmount = useCallback(
    (transaction: Transaction) =>
      originalAmountInBaseCurrency({
        originalAmount: transaction.amount,
        originalCurrency: transaction.currency,
        amountEur: transaction.amount_eur,
        baseCurrency,
        euroToBaseRate: rateForDate(transaction.transaction_date),
      }),
    [baseCurrency, rateForDate],
  );

  const synchronizedGpsInputs = useMemo<AiInsightsInputs>(() => {
    const sourceMonths = gpsInputs.cashFlow.monthly;
    const sourceCurrentMonth = sourceMonths.at(-1);
    const hasRecordedPosition =
      Math.abs(metrics.totalIncome) > 0.005 ||
      Math.abs(metrics.totalExpenses) > 0.005 ||
      Math.abs(metrics.totalSavings) > 0.005 ||
      Math.abs(metrics.netCashFlow) > 0.005;
    const synchronizedCurrentMonth = {
      month:
        sourceCurrentMonth?.month ||
        gpsInputs.generatedAt.slice(0, 7) ||
        new Date().toISOString().slice(0, 7),
      transactionCount: Math.max(
        sourceCurrentMonth?.transactionCount ?? 0,
        hasRecordedPosition ? 1 : 0,
      ),
      income: metrics.totalIncome,
      expenses: metrics.totalExpenses,
      savings: metrics.totalSavings,
      outflow: metrics.totalExpenses + metrics.totalSavings,
      netCashFlow: metrics.netCashFlow,
    };
    const synchronizedMonths = sourceCurrentMonth
      ? [...sourceMonths.slice(0, -1), synchronizedCurrentMonth]
      : [synchronizedCurrentMonth];

    return {
      ...gpsInputs,
      cashFlow: {
        ...gpsInputs.cashFlow,
        financialHealth: healthInputs,
        monthly: synchronizedMonths,
      },
    };
  }, [
    gpsInputs,
    healthInputs,
    metrics.netCashFlow,
    metrics.totalExpenses,
    metrics.totalIncome,
    metrics.totalSavings,
  ]);
  const financialGps = useMemo(
    () =>
      calculateFinancialGps(
        synchronizedGpsInputs,
        setupAcknowledgements,
      ),
    [setupAcknowledgements, synchronizedGpsInputs],
  );
  const horizonActivity = useMemo(
    () => recordedActivity.slice(0, 24).map((transaction) => ({
      amount: displayedTransactionAmount(transaction) ?? 0,
      income: isIncome(transaction),
    })),
    [displayedTransactionAmount, recordedActivity],
  );

  return (
    <>
      <header className="topbar">
        <div className="page-title">
          <h1>{greeting}, {name}.</h1>
          <p>Completed financial activity through today, displayed in your selected base currency. Scheduled entries remain visible but are excluded until their date.</p>
        </div>
        <div className={styles.headerActions}>
          <div
            className={`${styles.livePill} ${
              connectionState === "live"
                ? styles.live
                : connectionState === "offline"
                  ? styles.offline
                  : styles.connecting
            }`}
          >
            <span />
            {connectionState === "live"
              ? "Live"
              : connectionState === "offline"
                ? "Reconnecting"
                : "Connecting"}
          </div>
          <Link className="btn btn-gold" href="/dashboard/transactions">
            Add transaction
          </Link>
        </div>
      </header>

      {initialError ? <div className="alert alert-error">{initialError}</div> : null}

      <div className={styles.horizonOnly}>
        <HorizonCommandStrip gps={financialGps} />
        {gpsError ? (
          <div className="alert alert-error">
            Financial GPS could not refresh. Your recorded data remains unchanged.
          </div>
        ) : null}
      </div>

      <div className={styles.horizonOnly}>
        {!financialGps.active || financialGps.setupCompletion < 100 ? (
          <FinancialSetupSummary
            inputs={healthInputs}
            acknowledgements={setupAcknowledgements}
          />
        ) : null}
        <HorizonOverviewBoard
          income={displayActuals.totalIncome}
          expenses={displayActuals.totalExpenses}
          savings={displayActuals.totalSavings}
          cashFlow={displayActuals.netCashFlow}
          savingsRate={displaySavingsRate}
          activity={horizonActivity}
          gps={financialGps}
          valuesAlreadyInBaseCurrency
        />
        <FinancialJourneyRail gps={financialGps} />
      </div>

      <div className={styles.classicOnly}>
        <FinancialSetupSummary
          inputs={healthInputs}
          acknowledgements={setupAcknowledgements}
        />
        <FinancialGpsSummary
          inputs={gpsInputs}
          acknowledgements={setupAcknowledgements}
          error={gpsError}
        />

        <section className="kpis">
          <div className="kpi">
            <span>Income recorded</span>
            <strong>{formatCurrency(displayActuals.totalIncome, baseCurrency)}</strong>
            <small className={styles.kpiNote}>Displayed in your selected base currency</small>
          </div>
          <div className="kpi">
            <span>Expenses recorded</span>
            <strong>{formatCurrency(displayActuals.totalExpenses, baseCurrency)}</strong>
            <small className={styles.kpiNote}>Saving transfers are shown separately</small>
          </div>
          <div className="kpi">
            <span>Recorded cash position</span>
            <strong
              className={
                displayActuals.netCashFlow >= 0 ? "amount-positive" : "amount-negative"
              }
            >
              {formatCurrency(displayActuals.netCashFlow, baseCurrency)}
            </strong>
            <small className={styles.kpiNote}>Completed income minus completed outflows through today</small>
          </div>
          <div className="kpi">
            <span>Total savings rate</span>
            <strong>{(metrics.savingsRate * 100).toFixed(1)}%</strong>
            <small className={styles.kpiNote}>All recorded savings divided by income</small>
          </div>
        </section>
      </div>

      <FinancialHealthScore result={financialHealth} error={healthError} />

      <section className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Live transaction table</h3>
              <p className="muted">Completed and scheduled entries update instantly when data changes.</p>
            </div>
            <Link href="/dashboard/transactions">View all</Link>
          </div>

          {recent.length ? (
            <>
              <div
                className={`${styles.liveTable} ficonter-scroll-region`}
                tabIndex={recent.length > 10 ? 0 : undefined}
                aria-label="Live transaction history. The newest ten transactions are visible first; scroll for older records."
              >
                {recent.map((transaction) => {
                  const currency = transaction.currency || "EUR";
                  const originalAmount = finiteNumber(transaction.amount);
                  const income = isIncome(transaction);
                  const scheduled = Boolean(
                    todayKey && transaction.transaction_date > todayKey,
                  );

                  return (
                    <article className={styles.transactionRow} key={transaction.id}>
                      <div
                        className={`${styles.flowIcon} ${
                          income ? styles.incomeIcon : styles.expenseIcon
                        }`}
                      >
                        {income ? (
                          <ArrowUpRight size={18} />
                        ) : (
                          <ArrowDownRight size={18} />
                        )}
                      </div>
                      <div className={styles.transactionMain}>
                        <strong>{transaction.description}</strong>
                        <span>{transaction.category}</span>
                        <small>
                          <Clock3 size={13} /> {scheduled ? "Scheduled · " : ""}
                          {readableDateTime(transaction)}
                        </small>
                      </div>
                      <div className={styles.transactionAmount}>
                        <strong
                          className={
                            income ? "amount-positive" : "amount-negative"
                          }
                        >
                          {income ? "+" : "-"}
                          {(() => {
                            const displayedAmount = displayedTransactionAmount(transaction);
                            return displayedAmount === null
                              ? `— ${baseCurrency}`
                              : formatCurrency(displayedAmount, baseCurrency);
                          })()}
                        </strong>
                        {baseCurrency !== currency ? (
                          <span>
                            Original: {formatCurrency(originalAmount, currency)}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
              {recent.length > 10 ? (
                <p className={styles.scrollHint}>
                  Showing 10 transactions at a time · Scroll for older activity
                </p>
              ) : null}
            </>
          ) : (
            <div className="empty">
              Your financial story begins with your first transaction.
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Base currency view</h3>
            <WalletCards size={21} />
          </div>
          <div className={styles.infoCard}>
            <WalletCards size={22} />
            <div>
              <strong>One clear reporting currency</strong>
              <p>
                FICONTER preserves original currencies and converts the reporting view into <b>{baseCurrency}</b> without rewriting the original records.
              </p>
            </div>
          </div>
          <div className={styles.infoCard}>
            <RefreshCw size={22} />
            <div>
              <strong>Live synchronization</strong>
              <p>
                The same Wealth Engine inputs refresh when Transactions, Bills,
                Debt, Goals or Monthly Planner data changes.
              </p>
            </div>
          </div>
          <div className="stat-row">
            <span>Transactions recorded</span>
            <strong>{healthInputs.transactions.count}</strong>
          </div>
          <div className="stat-row">
            <span>Base currency</span>
            <strong>{baseCurrency}</strong>
          </div>
        </div>
      </section>
    </>
  );
}
