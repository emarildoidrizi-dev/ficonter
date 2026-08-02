import type { CashFlowIntelligenceInputs } from "@/lib/wealth/cashFlowIntelligence";
import {
  addMoney,
  finiteNumber,
  roundMoney,
  subtractMoney,
} from "@/lib/finance/money";

export type MonthlyCashTransaction = {
  id: string;
  type: string;
  amount_eur: number | string;
  transaction_date: string | null;
  occurred_at?: string | null;
};

export type MonthlyCashBill = {
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

export function transactionActivityDate(
  transaction: MonthlyCashTransaction,
): string {
  return (
    transaction.transaction_date ||
    transaction.occurred_at?.slice(0, 10) ||
    ""
  );
}

export function billActivityDate(bill: MonthlyCashBill): string {
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

function asTransactions(input: unknown): MonthlyCashTransaction[] {
  return Array.isArray(input)
    ? input.map((row) => {
        const value = (row ?? {}) as Partial<MonthlyCashTransaction>;
        return {
          id: String(value.id ?? ""),
          type: String(value.type ?? ""),
          amount_eur: value.amount_eur ?? 0,
          transaction_date: value.transaction_date ?? null,
          occurred_at: value.occurred_at ?? null,
        };
      })
    : [];
}

function asBills(input: unknown): MonthlyCashBill[] {
  return Array.isArray(input)
    ? input.map((row) => {
        const value = (row ?? {}) as Partial<MonthlyCashBill>;
        return {
          id: String(value.id ?? ""),
          status: String(value.status ?? ""),
          amount_eur: value.amount_eur ?? 0,
          due_date: String(value.due_date ?? ""),
          paid_at: value.paid_at ?? null,
          transaction_id: value.transaction_id ?? null,
        };
      })
    : [];
}

export function calculateMonthlyCashActuals(
  month: string,
  transactionInput: unknown,
  billInput: unknown,
): MonthlyCashActuals {
  const transactions = asTransactions(transactionInput);
  const bills = asBills(billInput);
  const linkedBillTransactionIds = new Set(
    bills
      .map((bill) => bill.transaction_id)
      .filter((transactionId): transactionId is string => Boolean(transactionId)),
  );

  const monthTransactions = transactions.filter((transaction) =>
    inFinancialMonth(transactionActivityDate(transaction), month),
  );
  const includedTransactions = monthTransactions.filter(
    (transaction) => !linkedBillTransactionIds.has(transaction.id),
  );
  const paidBills = bills.filter(
    (bill) =>
      bill.status === "paid" &&
      inFinancialMonth(billActivityDate(bill), month),
  );

  let income = 0;
  let expenses = 0;
  let savings = 0;

  includedTransactions.forEach((transaction) => {
    const amount = finiteNumber(transaction.amount_eur);

    if (transaction.type === "income") {
      income = addMoney(income, amount);
      return;
    }

    if (transaction.type === "saving") {
      savings = addMoney(savings, amount);
      return;
    }

    expenses = addMoney(expenses, amount);
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

function nextMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const value = new Date(Date.UTC(year, monthNumber, 1));
  return value.toISOString().slice(0, 7);
}

export function cashFlowHistoryBounds(
  input: CashFlowIntelligenceInputs,
): {
  start: string;
  endExclusive: string;
} {
  const firstMonth =
    input.monthly.at(0)?.month || new Date().toISOString().slice(0, 7);
  const lastMonth =
    input.monthly.at(-1)?.month || new Date().toISOString().slice(0, 7);

  return {
    start: `${firstMonth}-01`,
    endExclusive: `${nextMonth(lastMonth)}-01`,
  };
}

export function reconcileCashFlowMonthlyInputs(
  input: CashFlowIntelligenceInputs,
  transactionInput: unknown,
  billInput: unknown,
): CashFlowIntelligenceInputs {
  return {
    ...input,
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
