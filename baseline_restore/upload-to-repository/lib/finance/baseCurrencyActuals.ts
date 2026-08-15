import { normalizeCurrency } from "@/lib/finance/currencyEngine";
import {
  addMoney,
  finiteNumber,
  roundConvertedAmount,
  roundMoney,
  subtractMoney,
} from "@/lib/finance/money";
import type { CurrencyCode } from "@/lib/financialOptions";

export type BaseCurrencyTransaction = {
  id: string;
  amount: number | string;
  currency: string | null;
  amount_eur: number | string | null;
  type: string;
  category?: string | null;
  transaction_date: string;
};

export type BaseCurrencyBill = {
  id: string;
  amount: number | string;
  currency: string | null;
  amount_eur: number | string;
  status: string;
  due_date: string;
  paid_at: string | null;
  transaction_id: string | null;
};

export type BaseCurrencyCashActuals = {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  netCashFlow: number;
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

function isSaving(transaction: BaseCurrencyTransaction) {
  if (transaction.type === "saving" || transaction.type === "savings") {
    return true;
  }

  const category = (transaction.category ?? "").toLowerCase();
  return SAVING_WORDS.some((word) => category.includes(word));
}

export function originalAmountInBaseCurrency({
  originalAmount,
  originalCurrency,
  amountEur,
  baseCurrency,
  euroToBaseRate,
}: {
  originalAmount: unknown;
  originalCurrency: unknown;
  amountEur: unknown;
  baseCurrency: CurrencyCode;
  euroToBaseRate?: number | null;
}): number | null {
  const sourceCurrency = normalizeCurrency(originalCurrency, "EUR");
  const targetCurrency = normalizeCurrency(baseCurrency, "EUR");
  const sourceAmount = finiteNumber(originalAmount);

  // Sacred invariant:
  // if the user returns to the transaction's original currency, use the
  // original stored amount exactly. Never round-trip through EUR.
  if (sourceCurrency === targetCurrency) {
    return roundMoney(sourceAmount);
  }

  const canonicalEur =
    sourceCurrency === "EUR"
      ? sourceAmount
      : finiteNumber(amountEur);

  if (targetCurrency === "EUR") {
    return roundMoney(canonicalEur);
  }

  if (
    !euroToBaseRate ||
    !Number.isFinite(euroToBaseRate) ||
    euroToBaseRate <= 0
  ) {
    return null;
  }

  return roundConvertedAmount(canonicalEur * euroToBaseRate);
}

export function calculateBaseCurrencyCashActuals({
  transactions,
  bills,
  baseCurrency,
  throughDate,
  rateForDate,
}: {
  transactions: BaseCurrencyTransaction[];
  bills: BaseCurrencyBill[];
  baseCurrency: CurrencyCode;
  throughDate: string;
  rateForDate: (date?: string | null) => number | null;
}): BaseCurrencyCashActuals {
  const linkedTransactionIds = new Set(
    bills
      .map((bill) => bill.transaction_id)
      .filter((id): id is string => Boolean(id)),
  );

  let totalIncome = 0;
  let totalExpenses = 0;
  let totalSavings = 0;

  for (const transaction of transactions) {
    if (
      !transaction.transaction_date ||
      transaction.transaction_date > throughDate ||
      linkedTransactionIds.has(transaction.id)
    ) {
      continue;
    }

    const amount = originalAmountInBaseCurrency({
      originalAmount: transaction.amount,
      originalCurrency: transaction.currency,
      amountEur: transaction.amount_eur,
      baseCurrency,
      euroToBaseRate: rateForDate(transaction.transaction_date),
    });

    if (amount === null) continue;

    if (transaction.type === "income") {
      totalIncome = addMoney(totalIncome, amount);
    } else if (isSaving(transaction)) {
      totalSavings = addMoney(totalSavings, amount);
    } else {
      totalExpenses = addMoney(totalExpenses, amount);
    }
  }

  for (const bill of bills) {
    if (bill.status !== "paid") continue;
    const activityDate = bill.paid_at?.slice(0, 10) ?? bill.due_date;
    if (!activityDate || activityDate > throughDate) continue;

    const amount = originalAmountInBaseCurrency({
      originalAmount: bill.amount,
      originalCurrency: bill.currency,
      amountEur: bill.amount_eur,
      baseCurrency,
      euroToBaseRate: rateForDate(activityDate),
    });

    if (amount !== null) {
      totalExpenses = addMoney(totalExpenses, amount);
    }
  }

  return {
    totalIncome: roundMoney(totalIncome),
    totalExpenses: roundMoney(totalExpenses),
    totalSavings: roundMoney(totalSavings),
    netCashFlow: subtractMoney(
      totalIncome,
      totalExpenses,
      totalSavings,
    ),
  };
}
