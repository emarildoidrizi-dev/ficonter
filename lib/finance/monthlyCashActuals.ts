import type { AiInsightsInputs } from "@/lib/wealth/aiInsights";
import type { CashFlowIntelligenceInputs } from "@/lib/wealth/cashFlowIntelligence";
import type { FinancialHealthInputs } from "@/lib/wealth/financialHealth";
import {
  addMoney,
  finiteNumber,
  roundMoney,
  subtractMoney,
} from "@/lib/finance/money";

export type PlatformTransaction = {
  id: string;
  type: string;
  description?: string | null;
  category?: string | null;
  amount_eur: number | string | null;
  transaction_date: string | null;
  occurred_at?: string | null;
};

export type PlatformBill = {
  id: string;
  status: string;
  amount_eur: number | string;
  due_date: string;
  paid_at: string | null;
  transaction_id: string | null;
};

export type MonthlyCashActuals = {
  month: string;
  transactionCount: number;
  income: number;
  expenses: number;
  savings: number;
  paidBills: number;
  outflow: number;
  netCashFlow: number;
};

export type PlatformCashActuals = {
  count: number;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  netCashFlow: number;
  activeMonths: number;
  incomeMonths: number;
  expenseMonths: number;
  currentMonthOutflow: number;
};

const SAVING_WORDS = [
  "saving",
  "savings",
  "emergency fund",
  "retirement",
  "stocks",
  "etfs",
  "bonds",
  "crypto",
  "investment",
  "house deposit",
  "education fund",
];

const MONTHLY_BUDGET_DEBT_WORDS = [
  "debt",
  "loan",
  "credit-card",
  "credit card",
  "mortgage principal",
  "student-loan",
  "student loan",
  "personal-loan",
  "personal loan",
  "debt repayment",
];

const MONTHLY_BUDGET_TRANSFER_WORDS = [
  "account transfer",
  "cash deposit",
  "cash withdrawal",
  "opening balance",
  "balance correction",
  "currency conversion",
  "refund adjustment",
];

/**
 * Monthly spending budgets intentionally measure the Expenses bucket only.
 * Savings, debt repayments, transfers/adjustments, goals and bill-linked
 * transactions are separate financial commitments and must not consume the
 * user's discretionary expense budget.
 */
export function isMonthlyBudgetExpenseTransaction(
  transaction: PlatformTransaction,
): boolean {
  if (isIncome(transaction) || isSaving(transaction)) return false;

  const description = (transaction.description ?? "").trim().toLowerCase();
  if (description.startsWith("goal investment ·")) return false;

  const category = (transaction.category ?? "").trim().toLowerCase();
  if (MONTHLY_BUDGET_DEBT_WORDS.some((word) => category.includes(word))) {
    return false;
  }
  if (MONTHLY_BUDGET_TRANSFER_WORDS.some((word) => category.includes(word))) {
    return false;
  }

  const type = transaction.type.trim().toLowerCase();
  if (["saving", "savings", "debt", "transfer", "adjustment"].includes(type)) {
    return false;
  }

  return true;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function completedThroughForMonth(
  month: string,
  today = localDateKey(),
): string {
  const currentMonth = monthKey(today);
  if (month < currentMonth) return `${month}-31`;
  if (month === currentMonth) return today;
  return `${month}-00`;
}

function asTransactions(input: unknown): PlatformTransaction[] {
  return Array.isArray(input)
    ? input.map((row) => {
        const value = (row ?? {}) as Partial<PlatformTransaction>;
        return {
          id: String(value.id ?? ""),
          type: String(value.type ?? ""),
          description:
            typeof value.description === "string" ? value.description : null,
          category:
            typeof value.category === "string" ? value.category : null,
          amount_eur: value.amount_eur ?? 0,
          transaction_date:
            typeof value.transaction_date === "string"
              ? value.transaction_date
              : null,
          occurred_at:
            typeof value.occurred_at === "string" ? value.occurred_at : null,
        };
      })
    : [];
}

function asBills(input: unknown): PlatformBill[] {
  return Array.isArray(input)
    ? input.map((row) => {
        const value = (row ?? {}) as Partial<PlatformBill>;
        return {
          id: String(value.id ?? ""),
          status: String(value.status ?? ""),
          amount_eur: value.amount_eur ?? 0,
          due_date: String(value.due_date ?? ""),
          paid_at:
            typeof value.paid_at === "string" ? value.paid_at : null,
          transaction_id:
            typeof value.transaction_id === "string"
              ? value.transaction_id
              : null,
        };
      })
    : [];
}

export function transactionActivityDate(
  transaction: PlatformTransaction,
): string {
  return (
    transaction.transaction_date ||
    transaction.occurred_at?.slice(0, 10) ||
    ""
  );
}

export function billActivityDate(bill: PlatformBill): string {
  if (bill.status === "paid") {
    return bill.paid_at?.slice(0, 10) ?? bill.due_date;
  }

  return bill.due_date;
}

export function inFinancialMonth(
  value: string | null | undefined,
  month: string,
): boolean {
  return Boolean(value?.startsWith(month));
}

function isIncome(transaction: PlatformTransaction): boolean {
  return transaction.type === "income";
}

function isSaving(transaction: PlatformTransaction): boolean {
  if (transaction.type === "saving" || transaction.type === "savings") {
    return true;
  }

  const category = (transaction.category ?? "").toLowerCase();
  return SAVING_WORDS.some((word) => category.includes(word));
}

function linkedBillTransactionIds(
  bills: PlatformBill[],
): Set<string> {
  return new Set(
    bills
      .map((bill) => bill.transaction_id)
      .filter((id): id is string => Boolean(id)),
  );
}

function paidBillsThrough(
  bills: PlatformBill[],
  throughDate: string,
): PlatformBill[] {
  return bills.filter(
    (bill) =>
      bill.status === "paid" &&
      Boolean(billActivityDate(bill)) &&
      billActivityDate(bill) <= throughDate,
  );
}

function includedTransactionsThrough(
  transactions: PlatformTransaction[],
  bills: PlatformBill[],
  throughDate: string,
): PlatformTransaction[] {
  const linkedIds = linkedBillTransactionIds(bills);

  return transactions.filter((transaction) => {
    const date = transactionActivityDate(transaction);
    return (
      Boolean(date) &&
      date <= throughDate &&
      !linkedIds.has(transaction.id)
    );
  });
}

export function calculateMonthlyCashActuals(
  month: string,
  transactionInput: unknown,
  billInput: unknown,
): MonthlyCashActuals {
  const transactions = asTransactions(transactionInput);
  const bills = asBills(billInput);
  const throughDate = completedThroughForMonth(month);
  const includedTransactions = includedTransactionsThrough(
    transactions,
    bills,
    throughDate,
  ).filter((transaction) =>
    inFinancialMonth(transactionActivityDate(transaction), month),
  );
  const paidBills = paidBillsThrough(bills, throughDate).filter((bill) =>
    inFinancialMonth(billActivityDate(bill), month),
  );

  let income = 0;
  let expenses = 0;
  let savings = 0;

  includedTransactions.forEach((transaction) => {
    const amount = finiteNumber(transaction.amount_eur);
    if (isIncome(transaction)) {
      income = addMoney(income, amount);
    } else if (isSaving(transaction)) {
      savings = addMoney(savings, amount);
    } else {
      expenses = addMoney(expenses, amount);
    }
  });

  const paidBillsTotal = paidBills.reduce(
    (total, bill) => addMoney(total, bill.amount_eur),
    0,
  );
  expenses = addMoney(expenses, paidBillsTotal);
  const outflow = addMoney(expenses, savings);

  return {
    month,
    transactionCount: includedTransactions.length + paidBills.length,
    income: roundMoney(income),
    expenses: roundMoney(expenses),
    savings: roundMoney(savings),
    paidBills: roundMoney(paidBillsTotal),
    outflow: roundMoney(outflow),
    netCashFlow: subtractMoney(income, outflow),
  };
}

export function calculatePlatformCashActuals(
  transactionInput: unknown,
  billInput: unknown,
  throughDate = localDateKey(),
): PlatformCashActuals {
  const transactions = asTransactions(transactionInput);
  const bills = asBills(billInput);
  const includedTransactions = includedTransactionsThrough(
    transactions,
    bills,
    throughDate,
  );
  const paidBills = paidBillsThrough(bills, throughDate);

  let totalIncome = 0;
  let totalExpenses = 0;
  let totalSavings = 0;
  const activeMonths = new Set<string>();
  const incomeMonths = new Set<string>();
  const expenseMonths = new Set<string>();

  includedTransactions.forEach((transaction) => {
    const date = transactionActivityDate(transaction);
    const month = monthKey(date);
    const amount = finiteNumber(transaction.amount_eur);
    activeMonths.add(month);

    if (isIncome(transaction)) {
      totalIncome = addMoney(totalIncome, amount);
      incomeMonths.add(month);
    } else if (isSaving(transaction)) {
      totalSavings = addMoney(totalSavings, amount);
      expenseMonths.add(month);
    } else {
      totalExpenses = addMoney(totalExpenses, amount);
      expenseMonths.add(month);
    }
  });

  paidBills.forEach((bill) => {
    const month = monthKey(billActivityDate(bill));
    totalExpenses = addMoney(totalExpenses, bill.amount_eur);
    activeMonths.add(month);
    expenseMonths.add(month);
  });

  const currentMonth = monthKey(throughDate);
  const currentMonthActuals = calculateMonthlyCashActuals(
    currentMonth,
    transactions,
    bills,
  );

  return {
    count: includedTransactions.length + paidBills.length,
    totalIncome: roundMoney(totalIncome),
    totalExpenses: roundMoney(totalExpenses),
    totalSavings: roundMoney(totalSavings),
    netCashFlow: subtractMoney(
      totalIncome,
      totalExpenses,
      totalSavings,
    ),
    activeMonths: activeMonths.size,
    incomeMonths: incomeMonths.size,
    expenseMonths: expenseMonths.size,
    currentMonthOutflow: currentMonthActuals.outflow,
  };
}

export function reconcileFinancialHealthInputs(
  input: FinancialHealthInputs,
  transactionInput: unknown,
  billInput: unknown,
): FinancialHealthInputs {
  const actuals = calculatePlatformCashActuals(
    transactionInput,
    billInput,
  );

  return {
    ...input,
    generatedAt: new Date().toISOString(),
    transactions: {
      ...input.transactions,
      count: actuals.count,
      totalIncome: actuals.totalIncome,
      totalExpenses: actuals.totalExpenses,
      totalSavings: actuals.totalSavings,
      activeMonths: actuals.activeMonths,
      incomeMonths: actuals.incomeMonths,
      expenseMonths: actuals.expenseMonths,
      currentMonthOutflow: actuals.currentMonthOutflow,
    },
  };
}

export function reconcileCashFlowMonthlyInputs(
  input: CashFlowIntelligenceInputs,
  transactionInput: unknown,
  billInput: unknown,
): CashFlowIntelligenceInputs {
  return {
    ...input,
    generatedAt: new Date().toISOString(),
    financialHealth: reconcileFinancialHealthInputs(
      input.financialHealth,
      transactionInput,
      billInput,
    ),
    monthly: input.monthly.map((month) => {
      const actuals = calculateMonthlyCashActuals(
        month.month,
        transactionInput,
        billInput,
      );

      return {
        ...month,
        transactionCount: actuals.transactionCount,
        income: actuals.income,
        expenses: actuals.expenses,
        savings: actuals.savings,
        outflow: actuals.outflow,
        netCashFlow: actuals.netCashFlow,
      };
    }),
  };
}

export function reconcileAiInsightsInputs(
  input: AiInsightsInputs,
  transactionInput: unknown,
  billInput: unknown,
): AiInsightsInputs {
  return {
    ...input,
    generatedAt: new Date().toISOString(),
    cashFlow: reconcileCashFlowMonthlyInputs(
      input.cashFlow,
      transactionInput,
      billInput,
    ),
  };
}
