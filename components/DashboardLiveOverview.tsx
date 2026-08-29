"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isFinancialDataScope, subscribeFiconterDataChanges } from "@/lib/ficonterRealtime";
import { isFiconterNavigationPending } from "@/lib/navigationRuntime";
import { calculateBaseCurrencyCashActuals, originalAmountInBaseCurrency } from "@/lib/finance/baseCurrencyActuals";
import { isMonthlyBudgetExpenseTransaction } from "@/lib/finance/monthlyCashActuals";
import { canonicalAmountInBaseCurrency, reconcileAiInsightsToBaseCurrency, reconcileFinancialHealthToBaseCurrency } from "@/lib/finance/baseCurrencyReconciliation";
import { useCurrencyDisplay, useHistoricalReportingRates } from "@/components/CurrencyDisplayProvider";
import { useBaseCurrencySourceData } from "@/components/useBaseCurrencySourceData";
import { useEncryptedTransactions } from "@/components/EncryptedTransactionProvider";
import { useEncryptedBills } from "@/components/EncryptedBillProvider";
import { CoastalOverview, type CoastalUpcomingBill } from "@/components/CoastalOverview";
import { calculateFinancialHealth, type FinancialHealthInputs } from "@/lib/wealth/financialHealth";
import type { AiInsightsInputs } from "@/lib/wealth/aiInsights";
import { calculateFinancialGps } from "@/lib/wealth/financialGps";
import type { SetupAcknowledgements } from "@/lib/wealth/setupReadiness";
import {
  daypartForDate,
  greetingForDaypart,
  millisecondsUntilNextDaypart,
  type Daypart,
} from "@/lib/daypart";

type Transaction = {
  id: string;
  user_id?: string;
  description: string;
  amount: number | string;
  currency: string | null;
  amount_eur: number | string | null;
  exchange_rate_to_eur?: number | string | null;
  exchange_rate_date?: string | null;
  exchange_rate_source?: string | null;
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

type BudgetPlan = {
  month: string;
  spending_budget: number | string;
};

type Props = {
  userId: string;
  name: string;
  initialTransactions: Transaction[];
  initialBills: Bill[];
  initialBudgetPlans: BudgetPlan[];
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

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function DashboardLiveOverview({
  userId,
  name,
  initialTransactions,
  initialBudgetPlans,
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
  const { transactions, error: encryptedTransactionsError } = useEncryptedTransactions();
  const { bills, error: encryptedBillsError } = useEncryptedBills();
  const [daypart, setDaypart] = useState<Daypart>(() => daypartForDate());
  const { baseCurrency } = useCurrencyDisplay();
  const { source, context } = useBaseCurrencySourceData(userId);
  const now = new Date();
  const today = localDateKey(now);
  const currentMonthKey = monthKey(now);
  const previousMonthKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const historicalDates = useMemo(
    () => [
      ...transactions.map((transaction) => transaction.transaction_date),
      ...bills.map((bill) => bill.paid_at?.slice(0, 10) ?? bill.due_date),
    ],
    [bills, transactions],
  );
  const { rateForDate } = useHistoricalReportingRates(historicalDates);

  useEffect(() => {
    let timer: number | null = null;

    const syncDaypart = () => {
      setDaypart(daypartForDate());
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(syncDaypart, millisecondsUntilNextDaypart());
    };

    const handleDaypartUpdate = (event: Event) => {
      const next = (event as CustomEvent<{ daypart?: Daypart }>).detail?.daypart;
      setDaypart(next ?? daypartForDate());
    };

    syncDaypart();
    window.addEventListener("ficonter:daypart-updated", handleDaypartUpdate);
    window.addEventListener("focus", syncDaypart);

    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("ficonter:daypart-updated", handleDaypartUpdate);
      window.removeEventListener("focus", syncDaypart);
    };
  }, []);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => {
        refreshTimer.current = null;
        // If the user is already leaving Overview, the destination route will
        // fetch current data. Refreshing the old route here only creates an RSC
        // race and can make navigation feel stuck.
        if (isFiconterNavigationPending()) return;
        router.refresh();
      }, 220);
    };
    const channel = supabase
      .channel(`coastal-overview-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` }, scheduleRefresh)
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
      transactions,
      bills,
      baseCurrency,
      throughDate: today,
      rateForDate,
    });
  const financialHealthInputs = reconcileFinancialHealthToBaseCurrency(initialHealthInputs, source, context);
  const gpsInputs = reconcileAiInsightsToBaseCurrency(initialGpsInputs, source, context);
  const financialHealth = calculateFinancialHealth(financialHealthInputs);
  const financialGps = calculateFinancialGps(gpsInputs, initialSetupAcknowledgements);
  const linkedTransactionIds = new Set(bills.map((bill) => bill.transaction_id).filter(Boolean));

  const monthTotals = (() => {
    const totals: Record<string, { income: number; spent: number }> = {
      [currentMonthKey]: { income: 0, spent: 0 },
      [previousMonthKey]: { income: 0, spent: 0 },
    };
    transactions.forEach((transaction) => {
      if (transaction.transaction_date > today) return;
      const key = transaction.transaction_date.slice(0, 7);
      if (!totals[key] || linkedTransactionIds.has(transaction.id)) return;
      const amount = transactionAmount(transaction);
      if (amount === null) return;
      if (transaction.type === "income") totals[key].income += amount;
      else totals[key].spent += amount;
    });
    bills.forEach((bill) => {
      if (bill.status !== "paid") return;
      const activityDate = bill.paid_at?.slice(0, 10) ?? bill.due_date;
      if (activityDate > today) return;
      const key = activityDate.slice(0, 7);
      if (!totals[key]) return;
      const amount = billAmount(bill);
      if (amount !== null) totals[key].spent += amount;
    });
    return totals;
  })();

  const monthlyBudgetExpenseTotals = (() => {
    const totals: Record<string, number> = {
      [currentMonthKey]: 0,
      [previousMonthKey]: 0,
    };
    transactions.forEach((transaction) => {
      if (transaction.transaction_date > today) return;
      const key = transaction.transaction_date.slice(0, 7);
      if (!Object.prototype.hasOwnProperty.call(totals, key) || linkedTransactionIds.has(transaction.id)) return;
      const source = (transaction.exchange_rate_source ?? "").trim().toLowerCase();
      if (source === "automatic bill schedule" || source === "bill conversion") return;
      if (!isMonthlyBudgetExpenseTransaction(transaction)) return;
      const amount = transactionAmount(transaction);
      if (amount !== null) totals[key] += amount;
    });
    return totals;
  })();

  const stillToPay = bills.reduce((total, bill) => {
      if (bill.status === "paid" || bill.status === "cancelled") return total;
      return total + (billAmount(bill) ?? 0);
    }, 0);
  const upcomingBills: CoastalUpcomingBill[] = bills
      .filter((bill) => bill.status !== "paid" && bill.status !== "cancelled")
      .sort((left, right) => left.due_date.localeCompare(right.due_date))
      .slice(0, 3)
      .map((bill) => ({ id: bill.id, name: bill.name || "Upcoming bill", dueDate: bill.due_date, amount: billAmount(bill) }));
  const selectedBudgetPlan = initialBudgetPlans.find((plan) => plan.month === currentMonthKey);
  const spendingBudget = Math.max(
    0,
    canonicalAmountInBaseCurrency(selectedBudgetPlan?.spending_budget ?? 0, context),
  );
  const spendingAmount = monthlyBudgetExpenseTotals[currentMonthKey];
  // A percentage has no mathematical meaning until the customer has set a
  // monthly spending budget. Preserve the real ratio above 100% so an
  // overspent month is reported honestly instead of being capped at 100%.
  const spendingRhythm = spendingBudget > 0
    ? Math.max(0, (spendingAmount / spendingBudget) * 100)
    : null;
  const previousMonthBudgetExpenses = monthlyBudgetExpenseTotals[previousMonthKey];
  const previousMonthChange = previousMonthBudgetExpenses > 0
    ? ((spendingAmount - previousMonthBudgetExpenses) / previousMonthBudgetExpenses) * 100
    : null;

  return (
    <CoastalOverview
      name={name}
      greeting={greetingForDaypart(daypart)}
      currency={baseCurrency}
      availableNow={actuals.netCashFlow}
      stillToPay={stillToPay}
      monthLabel={new Intl.DateTimeFormat("en-GB", { month: "long" }).format(now)}
      monthIncome={monthTotals[currentMonthKey].income}
      monthSpent={monthTotals[currentMonthKey].spent}
      financialHealth={financialHealth}
      upcomingBills={upcomingBills}
      spendingRhythm={spendingRhythm}
      spendingAmount={spendingAmount}
      spendingBudget={spendingBudget}
      financialGps={financialGps}
      previousMonthChange={previousMonthChange}
      errorMessages={[initialError, initialHealthError, initialGpsError, encryptedTransactionsError, encryptedBillsError]}
    />
  );
}
