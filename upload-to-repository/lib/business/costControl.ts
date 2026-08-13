import { finiteNumber, subtractMoney, sumMoney } from "@/lib/finance/money";
import type {
  BusinessCostBudget,
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessTransaction,
} from "@/lib/business/types";

export function businessMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function businessMonthStart(monthKey: string) {
  return `${monthKey}-01`;
}

export function previousBusinessMonths(monthKey: string, count = 6) {
  const [year, month] = monthKey.split("-").map(Number);
  const anchor = new Date(year, month - 1, 1);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() - (count - 1 - index), 1);
    return businessMonthKey(date);
  });
}

export function calculateBusinessCostControl({
  transactions,
  budgets,
  categories,
  centres,
  monthKey,
}: {
  transactions: BusinessTransaction[];
  budgets: BusinessCostBudget[];
  categories: BusinessCostCategory[];
  centres: BusinessCostCentre[];
  monthKey: string;
}) {
  const monthTransactions = transactions.filter((item) =>
    item.transaction_date.startsWith(monthKey),
  );
  const expenses = monthTransactions.filter((item) => item.type === "expense");
  const income = monthTransactions.filter((item) => item.type === "income");
  const monthBudgets = budgets.filter((item) => item.budget_month.startsWith(monthKey));

  const revenue = sumMoney(income.map((item) => item.amount_base));
  const actualCosts = sumMoney(expenses.map((item) => item.amount_base));
  const fixedCosts = sumMoney(
    expenses.filter((item) => item.cost_nature === "fixed").map((item) => item.amount_base),
  );
  const variableCosts = sumMoney(
    expenses.filter((item) => item.cost_nature !== "fixed").map((item) => item.amount_base),
  );
  const budgetTotal = sumMoney(monthBudgets.map((item) => item.amount_base));
  const hasBudget = monthBudgets.length > 0;
  const budgetRemaining = subtractMoney(budgetTotal, actualCosts);
  const operatingResult = subtractMoney(revenue, actualCosts);
  const contributionMargin = subtractMoney(revenue, variableCosts);
  const contributionMarginRatio = revenue > 0 ? contributionMargin / revenue : 0;
  const breakEvenRevenue = contributionMarginRatio > 0
    ? fixedCosts / contributionMarginRatio
    : null;

  const categoryIds = new Set([
    ...categories.map((item) => item.id),
    ...expenses.map((item) => item.cost_category_id).filter(Boolean) as string[],
    ...monthBudgets.map((item) => item.category_id),
  ]);

  const categoryRows = [...categoryIds]
    .map((categoryId) => {
      const category = categories.find((item) => item.id === categoryId) ?? null;
      const categoryExpenses = expenses.filter((item) => item.cost_category_id === categoryId);
      const customName = categoryExpenses[0]?.category ?? "Deleted category";
      const actual = sumMoney(categoryExpenses.map((item) => item.amount_base));
      const budget = sumMoney(
        monthBudgets
          .filter((item) => item.category_id === categoryId)
          .map((item) => item.amount_base),
      );
      return {
        id: categoryId,
        name: category?.name ?? customName,
        nature: category?.default_nature ?? "variable",
        actual,
        budget,
        remaining: subtractMoney(budget, actual),
        usage: budget > 0 ? (actual / budget) * 100 : actual > 0 ? 100 : 0,
      };
    })
    .filter((item) => item.actual > 0 || item.budget > 0 || categories.some((c) => c.id === item.id))
    .sort((a, b) => b.actual - a.actual || a.name.localeCompare(b.name));

  const unassignedExpenses = expenses.filter((item) => !item.cost_category_id);
  if (unassignedExpenses.length) {
    const actual = sumMoney(unassignedExpenses.map((item) => item.amount_base));
    categoryRows.push({
      id: "unassigned",
      name: "Unassigned / custom",
      nature: "variable",
      actual,
      budget: 0,
      remaining: -actual,
      usage: 100,
    });
  }

  const centreRows = centres
    .map((centre) => {
      const actual = sumMoney(
        expenses
          .filter((item) => item.cost_centre_id === centre.id)
          .map((item) => item.amount_base),
      );
      return { id: centre.id, name: centre.name, actual };
    })
    .filter((item) => item.actual > 0)
    .sort((a, b) => b.actual - a.actual);

  const unassignedCentre = sumMoney(
    expenses.filter((item) => !item.cost_centre_id).map((item) => item.amount_base),
  );
  if (unassignedCentre > 0) {
    centreRows.push({ id: "unassigned", name: "Unassigned", actual: unassignedCentre });
  }

  const supplierMap = new Map<string, number>();
  expenses.forEach((item) => {
    const supplier = item.counterparty?.trim() || "No supplier specified";
    supplierMap.set(supplier, (supplierMap.get(supplier) ?? 0) + finiteNumber(item.amount_base));
  });
  const supplierRows = [...supplierMap.entries()]
    .map(([name, actual]) => ({ name, actual }))
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 8);

  const trend = previousBusinessMonths(monthKey, 6).map((key) => ({
    month: key,
    actual: sumMoney(
      transactions
        .filter((item) => item.type === "expense" && item.transaction_date.startsWith(key))
        .map((item) => item.amount_base),
    ),
    budget: sumMoney(
      budgets
        .filter((item) => item.budget_month.startsWith(key))
        .map((item) => item.amount_base),
    ),
  }));

  return {
    revenue,
    actualCosts,
    fixedCosts,
    variableCosts,
    budgetTotal,
    hasBudget,
    budgetRemaining,
    budgetUsage: budgetTotal > 0 ? (actualCosts / budgetTotal) * 100 : actualCosts > 0 ? 100 : 0,
    operatingResult,
    contributionMargin,
    contributionMarginRatio,
    breakEvenRevenue,
    categoryRows,
    centreRows,
    supplierRows,
    trend,
  };
}
