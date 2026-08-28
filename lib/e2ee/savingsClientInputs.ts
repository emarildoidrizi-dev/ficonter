import { finiteNumber, sumMoney } from "@/lib/finance/money";
import type { CurrencySourceData } from "@/lib/finance/baseCurrencyReconciliation";
import {
  normalizeSavingsIntelligenceInputs,
  type SavingsIntelligenceInputs,
} from "@/lib/wealth/savingsIntelligence";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function recentTwelveMonths(now = new Date()) {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1, 12, 0, 0, 0);
    return monthKey(date);
  });
}

function currentPlanner(source: CurrencySourceData, currentMonth: string) {
  const items = source.items.filter((item) => item.month === currentMonth);
  const plannedIncome = sumMoney(
    items
      .filter((item) => String(item.section ?? "").trim().toLowerCase().includes("income"))
      .map((item) => finiteNumber(item.planned_amount)),
  );
  const plannedOutflow = sumMoney(
    items
      .filter((item) => !String(item.section ?? "").trim().toLowerCase().includes("income"))
      .map((item) => finiteNumber(item.planned_amount)),
  );

  return {
    hasPlan: source.plans.some((plan) => plan.month === currentMonth) || items.length > 0,
    plannedIncome,
    plannedOutflow,
  };
}

export function buildSavingsClientInputs(
  source: CurrencySourceData,
  now = new Date(),
): SavingsIntelligenceInputs {
  const generatedAt = now.toISOString();
  const currentMonth = monthKey(now);
  const monthly = recentTwelveMonths(now).map((month) => ({
    month,
    transactionCount: 0,
    income: 0,
    expenses: 0,
    savings: 0,
    outflow: 0,
    netCashFlow: 0,
  }));

  const billCommitments = source.bills
    .filter((bill) => bill.status === "pending")
    .map((bill) => ({
      id: bill.id,
      kind: "bill" as const,
      name: bill.name || "Upcoming bill",
      category: bill.category || "Bill",
      dueDate: bill.due_date || null,
      amount: Math.max(0, finiteNumber(bill.amount_eur)),
    }));

  const debtCommitments = source.debts
    .filter((debt) => debt.status !== "paid_off")
    .map((debt) => ({
      id: debt.id,
      kind: "debt" as const,
      name: debt.name || "Debt minimum",
      category: debt.category || "Debt",
      dueDate: null,
      amount: Math.max(0, finiteNumber(debt.minimum_payment_eur)),
    }));

  const commitmentItems = [...billCommitments, ...debtCommitments];
  const billsTotal = sumMoney(billCommitments.map((item) => item.amount));
  const debtMinimums = sumMoney(debtCommitments.map((item) => item.amount));

  return normalizeSavingsIntelligenceInputs({
    schemaVersion: 3,
    generatedAt,
    cashFlow: {
      schemaVersion: 3,
      generatedAt,
      financialHealth: null,
      monthly,
      categories: [],
      commitments: {
        total: sumMoney([billsTotal, debtMinimums]),
        billsTotal,
        debtMinimums,
        items: commitmentItems,
      },
      planner: currentPlanner(source, currentMonth),
    },
    monthlySavings: [],
    categories: [],
    recentSavings: [],
    stats: {
      totalAmount: 0,
      contributionCount: 0,
      firstContributionAt: null,
      lastContributionAt: null,
    },
  });
}
