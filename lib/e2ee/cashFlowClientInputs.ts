import type { CurrencySourceData } from "@/lib/finance/baseCurrencyReconciliation";
import { finiteNumber, sumMoney } from "@/lib/finance/money";
import { buildNetWorthGrowthInputsFromSource } from "@/lib/wealth/netWorthClientInputs";
import {
  normalizeCashFlowIntelligenceInputs,
  type CashFlowIntelligenceInputs,
} from "@/lib/wealth/cashFlowIntelligence";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function recentTwelveMonths(now = new Date()) {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    return monthKey(date);
  });
}

function currentPlanner(source: CurrencySourceData, currentMonth: string) {
  const items = source.items.filter((item) => item.month === currentMonth);
  return {
    hasPlan: source.plans.some((plan) => plan.month === currentMonth) || items.length > 0,
    plannedIncome: sumMoney(
      items
        .filter((item) => String(item.section ?? "").trim().toLowerCase() === "income")
        .map((item) => finiteNumber(item.planned_amount)),
    ),
    plannedOutflow: sumMoney(
      items
        .filter((item) => String(item.section ?? "").trim().toLowerCase() !== "income")
        .map((item) => finiteNumber(item.planned_amount)),
    ),
  };
}

export function buildCashFlowClientInputs(
  source: CurrencySourceData,
  now = new Date(),
): CashFlowIntelligenceInputs {
  const generatedAt = now.toISOString();
  const today = localDateKey(now);
  const currentMonth = monthKey(now);
  const financialHealth =
    buildNetWorthGrowthInputsFromSource(source).wealthScore.financialHealth;

  const monthly = recentTwelveMonths(now).map((month) => ({
    month,
    transactionCount: 0,
    income: 0,
    expenses: 0,
    savings: 0,
    outflow: 0,
    netCashFlow: 0,
  }));

  const recentStart = new Date(now);
  recentStart.setDate(recentStart.getDate() - 89);
  const priorStart = new Date(now);
  priorStart.setDate(priorStart.getDate() - 179);
  const recentStartKey = localDateKey(recentStart);
  const priorStartKey = localDateKey(priorStart);

  const categoryMap = new Map<string, { recentAmount: number; priorAmount: number }>();
  for (const transaction of source.transactions) {
    if (String(transaction.type ?? "").toLowerCase() !== "expense") continue;
    if (!transaction.transaction_date || transaction.transaction_date > today) continue;
    const category = String(transaction.category ?? "").trim() || "Uncategorized";
    const row = categoryMap.get(category) ?? { recentAmount: 0, priorAmount: 0 };
    const amount = Math.max(0, finiteNumber(transaction.amount_eur));
    if (transaction.transaction_date >= recentStartKey) {
      row.recentAmount += amount;
    } else if (transaction.transaction_date >= priorStartKey) {
      row.priorAmount += amount;
    }
    categoryMap.set(category, row);
  }

  const categories = [...categoryMap.entries()]
    .filter(([, row]) => row.recentAmount > 0 || row.priorAmount > 0)
    .map(([category, row]) => ({ category, ...row }))
    .sort((a, b) => b.recentAmount - a.recentAmount || a.category.localeCompare(b.category))
    .slice(0, 8);

  const billCommitments = source.bills
    .filter(
      (bill) =>
        bill.status === "pending" &&
        bill.due_date >= today &&
        bill.due_date.slice(0, 7) === currentMonth,
    )
    .map((bill) => ({
      id: bill.id,
      kind: "bill" as const,
      name: bill.name || "Upcoming bill",
      category: bill.category || "Bill",
      dueDate: bill.due_date || null,
      amount: Math.max(0, finiteNumber(bill.amount_eur)),
    }));

  const debtCommitments = source.debts
    .filter(
      (debt) =>
        debt.status !== "paid_off" &&
        finiteNumber(debt.minimum_payment_eur) > 0,
    )
    .map((debt) => ({
      id: debt.id,
      kind: "debt" as const,
      name: debt.name || "Debt minimum",
      category: debt.category || "Debt",
      dueDate: null,
      amount: Math.max(0, finiteNumber(debt.minimum_payment_eur)),
    }));

  const items = [...billCommitments, ...debtCommitments].sort((a, b) => {
    const left = a.dueDate ?? "9999-12-31";
    const right = b.dueDate ?? "9999-12-31";
    return left.localeCompare(right) || b.amount - a.amount || a.name.localeCompare(b.name);
  });
  const billsTotal = sumMoney(billCommitments.map((item) => item.amount));
  const debtMinimums = sumMoney(debtCommitments.map((item) => item.amount));

  return normalizeCashFlowIntelligenceInputs({
    schemaVersion: 3,
    generatedAt,
    financialHealth,
    monthly,
    categories,
    commitments: {
      total: sumMoney([billsTotal, debtMinimums]),
      billsTotal,
      debtMinimums,
      items,
    },
    planner: currentPlanner(source, currentMonth),
  });
}
