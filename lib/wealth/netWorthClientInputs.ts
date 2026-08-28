import type { CurrencySourceData } from "@/lib/finance/baseCurrencyReconciliation";
import { finiteNumber, roundMoney, sumMoney } from "@/lib/finance/money";
import { normalizeFinancialHealthInputs } from "@/lib/wealth/financialHealth";
import type {
  NetWorthGrowthInputs,
  NetWorthGrowthMonth,
} from "@/lib/wealth/netWorthGrowth";

const MAX_HISTORY_MONTHS = 120;

type DebtRow = CurrencySourceData["debts"][number] & {
  created_at?: string | null;
  debt_kind?: string | null;
};

type PlanRow = CurrencySourceData["plans"][number] & {
  spending_budget?: number | string | null;
};

function monthKey(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}/.test(value)) return null;
  return value.slice(0, 7);
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, offset: number): string {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(first: string, last: string): string[] {
  const result: string[] = [];
  let cursor = first;
  while (cursor <= last && result.length < MAX_HISTORY_MONTHS) {
    result.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return result;
}

function monthEnd(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0, 23, 59, 59, 999)).toISOString();
}

function isIncome(type: unknown) {
  return String(type ?? "").toLowerCase() === "income";
}

function isExpense(type: unknown) {
  return String(type ?? "").toLowerCase() === "expense";
}

function isSaving(type: unknown) {
  const normalized = String(type ?? "").toLowerCase();
  return normalized === "saving" || normalized === "savings";
}

function debtCreatedMonth(debt: DebtRow): string | null {
  return monthKey(debt.created_at ?? debt.updated_at ?? null);
}

function historicalDebtBalance(
  debt: DebtRow,
  payments: CurrencySourceData["debtPayments"],
  endIso: string,
): number {
  const created = debt.created_at ?? debt.updated_at ?? null;
  if (created && created > endIso) return 0;

  const current = Math.max(0, finiteNumber(debt.current_balance_eur));
  const original = Math.max(current, finiteNumber(debt.original_balance_eur));
  const laterPayments = sumMoney(
    payments
      .filter(
        (payment) =>
          payment.debt_id === debt.id &&
          Boolean(payment.paid_at) &&
          payment.paid_at > endIso,
      )
      .map((payment) => finiteNumber(payment.amount_eur)),
  );

  return roundMoney(Math.min(original, current + laterPayments));
}

function buildFinancialHealth(source: CurrencySourceData) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = currentMonth();
  const next30 = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);

  const transactionMonths = new Set<string>();
  const incomeMonths = new Set<string>();
  const expenseMonths = new Set<string>();
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalSavings = 0;
  let emergencyFundSavings = 0;
  let goalInvestments = 0;
  let currentMonthOutflow = 0;

  for (const transaction of source.transactions) {
    const transactionMonth = monthKey(transaction.transaction_date);
    if (transactionMonth) transactionMonths.add(transactionMonth);
    const amount = Math.max(0, finiteNumber(transaction.amount_eur));
    if (isIncome(transaction.type)) {
      totalIncome += amount;
      if (transactionMonth) incomeMonths.add(transactionMonth);
    } else if (isSaving(transaction.type)) {
      totalSavings += amount;
      if (transactionMonth) expenseMonths.add(transactionMonth);
      if (String(transaction.category ?? "").trim().toLowerCase() === "emergency fund") {
        emergencyFundSavings += amount;
      }
      if (String(transaction.description ?? "").toLowerCase().startsWith("goal investment")) {
        goalInvestments += amount;
      }
      if (transactionMonth === month) currentMonthOutflow += amount;
    } else if (isExpense(transaction.type)) {
      totalExpenses += amount;
      if (transactionMonth) expenseMonths.add(transactionMonth);
      if (transactionMonth === month) currentMonthOutflow += amount;
    }
  }

  const paidBills = source.bills.filter((bill) => bill.status === "paid");
  const pendingBills = source.bills.filter((bill) => bill.status === "pending");
  const activeDebts = (source.debts as DebtRow[]).filter((debt) => debt.status !== "paid_off");
  const activeGoals = source.goals.filter((goal) => goal.status === "active");
  const completedGoals = source.goals.filter((goal) => goal.status === "completed");
  const currentPlan = (source.plans as PlanRow[]).find((plan) => plan.month === month);
  const currentItems = source.items.filter((item) => item.month === month);

  const debtPayments = sumMoney(source.debtPayments.map((payment) => finiteNumber(payment.amount_eur)));
  const originalDebt = sumMoney(activeDebts.map((debt) => finiteNumber(debt.original_balance_eur)));
  const currentDebt = sumMoney(activeDebts.map((debt) => finiteNumber(debt.current_balance_eur)));
  const minimumDebt = sumMoney(activeDebts.map((debt) => finiteNumber(debt.minimum_payment_eur)));
  const averageInterest = activeDebts.length
    ? activeDebts.reduce((total, debt) => total + finiteNumber(debt.annual_interest_rate), 0) / activeDebts.length
    : 0;

  return normalizeFinancialHealthInputs({
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    transactions: {
      count: source.transactions.length,
      totalIncome: roundMoney(totalIncome),
      totalExpenses: roundMoney(totalExpenses),
      totalSavings: roundMoney(totalSavings),
      emergencyFundSavings: roundMoney(emergencyFundSavings),
      goalInvestments: roundMoney(goalInvestments),
      debtPayments,
      activeMonths: transactionMonths.size,
      incomeMonths: incomeMonths.size,
      expenseMonths: expenseMonths.size,
      currentMonthOutflow: roundMoney(currentMonthOutflow),
    },
    bills: {
      count: source.bills.length,
      pendingCount: pendingBills.length,
      overdueCount: pendingBills.filter((bill) => bill.due_date < today).length,
      paidCount: paidBills.length,
      paidOnTimeCount: paidBills.filter((bill) => !bill.paid_at || bill.paid_at.slice(0, 10) <= bill.due_date).length,
      dueNext30DaysCount: pendingBills.filter((bill) => bill.due_date >= today && bill.due_date <= next30).length,
      pendingAmount: sumMoney(pendingBills.map((bill) => finiteNumber(bill.amount_eur))),
      oneMonthAmount: sumMoney(
        pendingBills
          .filter((bill) => bill.due_date >= today && bill.due_date <= next30)
          .map((bill) => finiteNumber(bill.amount_eur)),
      ),
    },
    debts: {
      count: source.debts.length,
      activeCount: activeDebts.length,
      originalBalance: originalDebt,
      currentBalance: currentDebt,
      minimumMonthlyPayment: minimumDebt,
      averageInterestRate: averageInterest,
    },
    goals: {
      count: source.goals.length,
      activeCount: activeGoals.length,
      completedCount: completedGoals.length,
      totalTarget: sumMoney(source.goals.map((goal) => finiteNumber(goal.target_amount))),
      totalCurrent: sumMoney(source.goals.map((goal) => finiteNumber(goal.current_amount))),
    },
    planner: {
      currentMonth: month,
      hasPlan: Boolean(currentPlan),
      itemCount: currentItems.length,
      plannedIncome: sumMoney(
        currentItems
          .filter((item) => item.section === "income")
          .map((item) => finiteNumber(item.planned_amount)),
      ),
      plannedOutflow: sumMoney(
        currentItems
          .filter((item) => item.section !== "income")
          .map((item) => finiteNumber(item.planned_amount)),
      ),
    },
  });
}

export function buildNetWorthGrowthInputsFromSource(
  source: CurrencySourceData,
): NetWorthGrowthInputs {
  const nowMonth = currentMonth();
  const debts = source.debts as DebtRow[];
  const activityMonths = [
    ...source.transactions.map((transaction) => monthKey(transaction.transaction_date)),
    ...debts.map(debtCreatedMonth),
    ...source.debtPayments.map((payment) => monthKey(payment.paid_at)),
  ].filter((value): value is string => Boolean(value));

  const naturalFirst = activityMonths.length
    ? [...activityMonths].sort()[0]
    : nowMonth;
  const boundedFirst = naturalFirst < shiftMonth(nowMonth, -(MAX_HISTORY_MONTHS - 1))
    ? shiftMonth(nowMonth, -(MAX_HISTORY_MONTHS - 1))
    : naturalFirst;
  const months = monthsBetween(boundedFirst, nowMonth);

  let cumulativeCapital = sumMoney(
    source.transactions
      .filter((transaction) => {
        const key = monthKey(transaction.transaction_date);
        return Boolean(key && key < boundedFirst);
      })
      .map((transaction) => {
        const amount = finiteNumber(transaction.amount_eur);
        if (isIncome(transaction.type)) return amount;
        if (isExpense(transaction.type)) return -amount;
        return 0;
      }),
  );
  let cumulativeSavings = sumMoney(
    source.transactions
      .filter((transaction) => {
        const key = monthKey(transaction.transaction_date);
        return Boolean(key && key < boundedFirst && isSaving(transaction.type));
      })
      .map((transaction) => finiteNumber(transaction.amount_eur)),
  );

  let previousDebt = 0;
  let previousNetWorth = cumulativeCapital;
  const growth: NetWorthGrowthMonth[] = [];

  for (const month of months) {
    const monthTransactions = source.transactions.filter(
      (transaction) => monthKey(transaction.transaction_date) === month,
    );
    const income = sumMoney(
      monthTransactions.filter((transaction) => isIncome(transaction.type)).map((transaction) => finiteNumber(transaction.amount_eur)),
    );
    const expenses = sumMoney(
      monthTransactions.filter((transaction) => isExpense(transaction.type)).map((transaction) => finiteNumber(transaction.amount_eur)),
    );
    const savings = sumMoney(
      monthTransactions.filter((transaction) => isSaving(transaction.type)).map((transaction) => finiteNumber(transaction.amount_eur)),
    );
    const retainedCapital = roundMoney(income - expenses);
    const availableCashChange = roundMoney(income - expenses - savings);
    cumulativeCapital = roundMoney(cumulativeCapital + retainedCapital);
    cumulativeSavings = roundMoney(cumulativeSavings + savings);

    const endIso = monthEnd(month);
    const debtOutstanding = sumMoney(
      debts.map((debt) => historicalDebtBalance(debt, source.debtPayments, endIso)),
    );
    const debtPayments = sumMoney(
      source.debtPayments
        .filter((payment) => monthKey(payment.paid_at) === month)
        .map((payment) => finiteNumber(payment.amount_eur)),
    );
    const debtChange = roundMoney(debtOutstanding - previousDebt);
    const netWorth = roundMoney(cumulativeCapital - debtOutstanding);
    const netWorthChange = roundMoney(netWorth - previousNetWorth);

    growth.push({
      month,
      transactionCount: monthTransactions.length,
      income,
      expenses,
      savings,
      retainedCapital,
      availableCashChange,
      cumulativeCapital,
      cumulativeSavings,
      debtOutstanding,
      debtPayments,
      debtChange,
      netWorth,
      netWorthChange,
    });

    previousDebt = debtOutstanding;
    previousNetWorth = netWorth;
  }

  const financialHealth = buildFinancialHealth(source);
  const totalIncome = sumMoney(source.transactions.filter((transaction) => isIncome(transaction.type)).map((transaction) => finiteNumber(transaction.amount_eur)));
  const totalExpenses = sumMoney(source.transactions.filter((transaction) => isExpense(transaction.type)).map((transaction) => finiteNumber(transaction.amount_eur)));
  const totalSavings = sumMoney(source.transactions.filter((transaction) => isSaving(transaction.type)).map((transaction) => finiteNumber(transaction.amount_eur)));
  const availableCash = roundMoney(totalIncome - totalExpenses - totalSavings);
  const recordedCapital = roundMoney(availableCash + totalSavings);
  const activeDebts = debts.filter((debt) => debt.status !== "paid_off");
  const currentDebt = sumMoney(activeDebts.map((debt) => finiteNumber(debt.current_balance_eur)));
  const recent = growth.slice(-3);
  const prior = growth.slice(-6, -3);
  const historyMonths = growth.filter(
    (row) => row.transactionCount > 0 || row.debtOutstanding > 0 || row.debtPayments > 0,
  ).length;

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    wealthScore: {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      financialHealth,
      wealth: {
        availableCash,
        recordedSavings: totalSavings,
        recordedCapital,
        currentDebt,
        netWorth: roundMoney(recordedCapital - currentDebt),
        recent3MonthIncome: sumMoney(recent.map((row) => row.income)),
        recent3MonthRetainedCapital: sumMoney(recent.map((row) => row.retainedCapital)),
        prior3MonthIncome: sumMoney(prior.map((row) => row.income)),
        prior3MonthRetainedCapital: sumMoney(prior.map((row) => row.retainedCapital)),
        historyMonths,
      },
      monthly: growth.map((row) => ({
        month: row.month,
        transactionCount: row.transactionCount,
        income: row.income,
        expenses: row.expenses,
        savings: row.savings,
        retainedCapital: row.retainedCapital,
        availableCashChange: row.availableCashChange,
      })),
      liabilities: activeDebts.map((debt) => ({
        id: debt.id,
        name: debt.name || (debt.debt_kind === "credit_card" ? "Credit card" : "Debt"),
        originalBalance: finiteNumber(debt.original_balance_eur),
        currentBalance: finiteNumber(debt.current_balance_eur),
        annualInterestRate: finiteNumber(debt.annual_interest_rate),
        status: debt.status || "active",
        updatedAt: debt.updated_at || new Date().toISOString(),
      })),
    },
    growth: {
      firstMonth: growth[0]?.month ?? null,
      historyMonths,
      monthly: growth,
    },
  };
}
