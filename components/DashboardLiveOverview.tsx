"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isFinancialDataScope, subscribeFiconterDataChanges } from "@/lib/ficonterRealtime";
import { calculateBaseCurrencyCashActuals, originalAmountInBaseCurrency } from "@/lib/finance/baseCurrencyActuals";
import { reconcileAiInsightsToBaseCurrency, reconcileFinancialHealthToBaseCurrency } from "@/lib/finance/baseCurrencyReconciliation";
import { useCurrencyDisplay, useHistoricalReportingRates } from "@/components/CurrencyDisplayProvider";
import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";
import { CoastalOverview, type CoastalUpcomingBill } from "@/components/CoastalOverview";
import { calculateFinancialHealth, type FinancialHealthInputs } from "@/lib/wealth/financialHealth";
import type { AiInsightsInputs } from "@/lib/wealth/aiInsights";
import { calculateFinancialGps } from "@/lib/wealth/financialGps";
import type { SetupAcknowledgements } from "@/lib/wealth/setupReadiness";

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
  name: string;
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

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
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
  const router = useRouter();
  const refreshTimer = useRef<number | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const { baseCurrency } = useCurrencyDisplay();
  const { source, context } = useBaseCurrencySourceData(userId);
  const now = new Date();
  const today = localDateKey(now);
  const currentMonthKey = monthKey(now);
  const previousMonthKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const historicalDates = useMemo(
    () => [
      ...initialTransactions.map((transaction) => transaction.transaction_date),
      ...initialBills.map((bill) => bill.paid_at?.slice(0, 10) ?? bill.due_date),
    ],
    [initialBills, initialTransactions],
  );
  const { rateForDate } = useHistoricalReportingRates(historicalDates);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => {
        refreshTimer.current = null;
        router.refresh();
      }, 220);
    };
    const channel = supabase
      .channel(`coastal-overview-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "bills", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "debts", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "goals", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "monthly_budget_plans", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "monthly_budget_items", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .subscribe();
    const unsubscribe = subscribeFiconterDataChanges((change) => {
      if (isFinancialDataScope(change.scope)) scheduleRefresh();
    });
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [router, supabase, userId]);

  const transactionAmount = (transaction: Transaction) => originalAmountInBaseCurrency({
      originalAmount: transaction.amount,
      originalCurrency: transaction.currency,
      amountEur: transaction.amount_eur,
      baseCurrency,
      euroToBaseRate: rateForDate(transaction.transaction_date),
    });
  const billAmount = (bill: Bill) => originalAmountInBaseCurrency({
      originalAmount: bill.amount,
      originalCurrency: bill.currency,
      amountEur: bill.amount_eur,
      baseCurrency,
      euroToBaseRate: rateForDate(bill.paid_at?.slice(0, 10) ?? bill.due_date),
    });

  const actuals = calculateBaseCurrencyCashActuals({
      transactions: initialTransactions,
      bills: initialBills,
      baseCurrency,
      throughDate: today,
      rateForDate,
    });
  const financialHealthInputs = reconcileFinancialHealthToBaseCurrency(initialHealthInputs, source, context);
  const gpsInputs = reconcileAiInsightsToBaseCurrency(initialGpsInputs, source, context);
  const financialHealth = calculateFinancialHealth(financialHealthInputs);
  const financialGps = calculateFinancialGps(gpsInputs, initialSetupAcknowledgements);
  const linkedTransactionIds = new Set(initialBills.map((bill) => bill.transaction_id).filter(Boolean));

  const monthTotals = (() => {
    const totals: Record<string, { income: number; spent: number }> = {
      [currentMonthKey]: { income: 0, spent: 0 },
      [previousMonthKey]: { income: 0, spent: 0 },
    };
    initialTransactions.forEach((transaction) => {
      const key = transaction.transaction_date.slice(0, 7);
      if (!totals[key] || linkedTransactionIds.has(transaction.id)) return;
      const amount = transactionAmount(transaction);
      if (amount === null) return;
      if (transaction.type === "income") totals[key].income += amount;
      else totals[key].spent += amount;
    });
    initialBills.forEach((bill) => {
      if (bill.status !== "paid") return;
      const key = (bill.paid_at?.slice(0, 10) ?? bill.due_date).slice(0, 7);
      if (!totals[key]) return;
      const amount = billAmount(bill);
      if (amount !== null) totals[key].spent += amount;
    });
    return totals;
  })();

  const stillToPay = initialBills.reduce((total, bill) => {
      if (bill.status === "paid" || bill.status === "cancelled") return total;
      return total + (billAmount(bill) ?? 0);
    }, 0);
  const upcomingBills: CoastalUpcomingBill[] = initialBills
      .filter((bill) => bill.status !== "paid" && bill.status !== "cancelled")
      .sort((left, right) => left.due_date.localeCompare(right.due_date))
      .slice(0, 3)
      .map((bill) => ({ id: bill.id, name: bill.name || "Upcoming bill", dueDate: bill.due_date, amount: billAmount(bill) }));
  const spendingBudget = Math.max(0, financialHealthInputs.planner.plannedOutflow);
  const spendingAmount = monthTotals[currentMonthKey].spent;
  const spendingRhythm = spendingBudget > 0 ? clamp((spendingAmount / spendingBudget) * 100, 0, 100) : 0;
  const previousMonthChange = monthTotals[previousMonthKey].spent > 0
    ? ((spendingAmount - monthTotals[previousMonthKey].spent) / monthTotals[previousMonthKey].spent) * 100
    : null;

  return (
    <CoastalOverview
      name={name}
      greeting={greetingForHour(now.getHours())}
      currency={baseCurrency}
      availableNow={actuals.netCashFlow}
      stillToPay={stillToPay}
      monthLabel={new Intl.DateTimeFormat("en-GB", { month: "long" }).format(now)}
      monthIncome={monthTotals[currentMonthKey].income}
      monthSpent={spendingAmount}
      financialHealth={financialHealth}
      upcomingBills={upcomingBills}
      spendingRhythm={spendingRhythm}
      spendingAmount={spendingAmount}
      spendingBudget={spendingBudget}
      financialGps={financialGps}
      previousMonthChange={previousMonthChange}
      errorMessages={[initialError, initialHealthError, initialGpsError]}
    />
  );
}
