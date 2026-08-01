import {
  calculateFinancialHealth,
  normalizeFinancialHealthInputs,
  type FinancialHealthInputs,
  type FinancialHealthResult,
} from "@/lib/wealth/financialHealth";

export type CashFlowMonth = {
  month: string;
  transactionCount: number;
  income: number;
  expenses: number;
  savings: number;
  outflow: number;
  netCashFlow: number;
};

export type CashFlowCategoryInput = {
  category: string;
  recentAmount: number;
  priorAmount: number;
};

export type CashFlowCommitment = {
  id: string;
  kind: "bill" | "debt";
  name: string;
  category: string;
  dueDate: string | null;
  amount: number;
  originalAmount?: number;
  paidThisMonth?: number;
};

export type CashFlowDebtPaymentInput = {
  debtId: string;
  amountEur: number;
  paidAt: string;
};

export type CashFlowIntelligenceInputs = {
  schemaVersion: number;
  generatedAt: string;
  financialHealth: FinancialHealthInputs;
  monthly: CashFlowMonth[];
  categories: CashFlowCategoryInput[];
  commitments: {
    total: number;
    billsTotal: number;
    debtMinimums: number;
    items: CashFlowCommitment[];
  };
  planner: {
    hasPlan: boolean;
    plannedIncome: number;
    plannedOutflow: number;
  };
};

export type CashFlowOutlookLabel =
  | "Strong"
  | "Positive"
  | "Tight"
  | "Negative"
  | "Not enough data";

export type CashFlowInsightTone = "positive" | "info" | "warning" | "critical";

export type CashFlowInsight = {
  id: string;
  title: string;
  detail: string;
  action: string;
  tone: CashFlowInsightTone;
};

export type CashFlowCategory = CashFlowCategoryInput & {
  share: number;
  changePercent: number | null;
};

export type CashFlowIntelligenceResult = {
  version: "1.0";
  label: CashFlowOutlookLabel;
  summary: string;
  confidence: "High" | "Moderate" | "Developing" | "No data";
  dataCoverage: number;
  forecastAvailable: boolean;
  nextBestAction: string;
  health: FinancialHealthResult;
  metrics: {
    currentMonthIncome: number;
    currentMonthExpenses: number;
    currentMonthSavings: number;
    currentMonthOutflow: number;
    currentMonthNetCashFlow: number;
    averageMonthlyIncome: number;
    averageMonthlyOutflow: number;
    averageMonthlyNetCashFlow: number;
    expectedIncome: number;
    expectedOutflow: number;
    projectedNetCashFlow: number;
    projectedMargin: number;
    knownCommitments: number;
    commitmentRatio: number;
    recentNetAverage: number;
    priorNetAverage: number;
    trendChange: number;
    trendPercent: number | null;
    volatility: number;
    incomeConsistency: number;
    availableNow: number;
    stillToPay: number;
    leftAfterPayments: number;
    paidDebtMinimumsThisMonth: number;
  };
  monthly: CashFlowMonth[];
  categories: CashFlowCategory[];
  commitments: CashFlowIntelligenceInputs["commitments"];
  insights: CashFlowInsight[];
};

const EMPTY_INPUTS: CashFlowIntelligenceInputs = {
  schemaVersion: 1,
  generatedAt: new Date(0).toISOString(),
  financialHealth: normalizeFinancialHealthInputs(null),
  monthly: [],
  categories: [],
  commitments: {
    total: 0,
    billsTotal: 0,
    debtMinimums: 0,
    items: [],
  },
  planner: {
    hasPlan: false,
    plannedIncome: 0,
    plannedOutflow: 0,
  },
};

function finite(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integer(value: unknown): number {
  return Math.max(0, Math.trunc(finite(value)));
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function normalizeMonth(value: unknown): CashFlowMonth {
  const row = object(value);
  const income = finite(row.income);
  const expenses = finite(row.expenses);
  const savings = finite(row.savings);
  const outflow = finite(row.outflow, expenses + savings);

  return {
    month: string(row.month),
    transactionCount: integer(row.transactionCount),
    income,
    expenses,
    savings,
    outflow,
    netCashFlow: finite(row.netCashFlow, income - outflow),
  };
}

function normalizeCategory(value: unknown): CashFlowCategoryInput {
  const row = object(value);
  return {
    category: string(row.category, "Uncategorized") || "Uncategorized",
    recentAmount: Math.max(0, finite(row.recentAmount)),
    priorAmount: Math.max(0, finite(row.priorAmount)),
  };
}

function normalizeCommitment(value: unknown): CashFlowCommitment | null {
  const row = object(value);
  const id = string(row.id);
  const kind = row.kind === "debt" ? "debt" : row.kind === "bill" ? "bill" : null;
  if (!id || !kind) return null;

  return {
    id,
    kind,
    name: string(row.name, kind === "bill" ? "Upcoming bill" : "Debt minimum"),
    category: string(row.category, kind === "bill" ? "Bill" : "Debt"),
    dueDate: typeof row.dueDate === "string" ? row.dueDate : null,
    amount: Math.max(0, finite(row.amount)),
  };
}

function normalizeDebtPayment(value: unknown): CashFlowDebtPaymentInput | null {
  const row = object(value);
  const debtId = string(row.debtId, string(row.debt_id));
  const paidAt = string(row.paidAt, string(row.paid_at));
  if (!debtId || !paidAt) return null;

  return {
    debtId,
    amountEur: Math.max(0, finite(row.amountEur, finite(row.amount_eur))),
    paidAt,
  };
}

export function normalizeCashFlowIntelligenceInputs(
  value: unknown,
): CashFlowIntelligenceInputs {
  const root = object(value);
  const commitments = object(root.commitments);
  const planner = object(root.planner);

  const items = array(commitments.items)
    .map(normalizeCommitment)
    .filter((item): item is CashFlowCommitment => Boolean(item));

  return {
    schemaVersion: integer(root.schemaVersion) || 1,
    generatedAt: string(root.generatedAt, new Date().toISOString()),
    financialHealth: normalizeFinancialHealthInputs(root.financialHealth),
    monthly: array(root.monthly).map(normalizeMonth),
    categories: array(root.categories).map(normalizeCategory),
    commitments: {
      total: Math.max(0, finite(commitments.total)),
      billsTotal: Math.max(0, finite(commitments.billsTotal)),
      debtMinimums: Math.max(0, finite(commitments.debtMinimums)),
      items,
    },
    planner: {
      hasPlan: planner.hasPlan === true,
      plannedIncome: Math.max(0, finite(planner.plannedIncome)),
      plannedOutflow: Math.max(0, finite(planner.plannedOutflow)),
    },
  };
}

export function normalizeCashFlowDebtPayments(
  value: unknown,
): CashFlowDebtPaymentInput[] {
  return array(value)
    .map(normalizeDebtPayment)
    .filter((item): item is CashFlowDebtPaymentInput => Boolean(item));
}

function monthKey(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function confidenceFor(coverage: number): CashFlowIntelligenceResult["confidence"] {
  if (coverage <= 0) return "No data";
  if (coverage >= 75) return "High";
  if (coverage >= 45) return "Moderate";
  return "Developing";
}

function outlookLabel(
  leftAfterPayments: number,
  projectedMargin: number,
  commitmentRatio: number,
): CashFlowOutlookLabel {
  if (leftAfterPayments < 0) return "Negative";
  if (projectedMargin < 0.08 || commitmentRatio > 0.75) return "Tight";
  if (projectedMargin < 0.2 || commitmentRatio > 0.5) return "Positive";
  return "Strong";
}

function adjustCommitments(
  commitments: CashFlowIntelligenceInputs["commitments"],
  debtPayments: CashFlowDebtPaymentInput[],
  currentMonth: string,
): CashFlowIntelligenceInputs["commitments"] & {
  paidDebtMinimumsThisMonth: number;
} {
  const paymentsByDebt = new Map<string, number>();

  for (const payment of debtPayments) {
    if (monthKey(payment.paidAt) !== currentMonth) continue;
    paymentsByDebt.set(
      payment.debtId,
      round((paymentsByDebt.get(payment.debtId) ?? 0) + payment.amountEur),
    );
  }

  let paidDebtMinimumsThisMonth = 0;
  const items = commitments.items
    .map((item) => {
      if (item.kind !== "debt") {
        return {
          ...item,
          originalAmount: item.amount,
          paidThisMonth: 0,
        };
      }

      const debtId = item.id.startsWith("debt:") ? item.id.slice(5) : item.id;
      const totalPaid = paymentsByDebt.get(debtId) ?? 0;
      const creditedPayment = Math.min(item.amount, totalPaid);
      const remaining = Math.max(0, round(item.amount - creditedPayment));
      paidDebtMinimumsThisMonth = round(
        paidDebtMinimumsThisMonth + creditedPayment,
      );

      return {
        ...item,
        amount: remaining,
        originalAmount: item.amount,
        paidThisMonth: creditedPayment,
      };
    })
    .filter((item) => item.amount > 0);

  const billsTotal = round(
    items
      .filter((item) => item.kind === "bill")
      .reduce((sum, item) => sum + item.amount, 0),
  );
  const debtMinimums = round(
    items
      .filter((item) => item.kind === "debt")
      .reduce((sum, item) => sum + item.amount, 0),
  );

  return {
    total: round(billsTotal + debtMinimums),
    billsTotal,
    debtMinimums,
    items,
    paidDebtMinimumsThisMonth,
  };
}

export function calculateCashFlowIntelligence(
  input: CashFlowIntelligenceInputs = EMPTY_INPUTS,
  debtPaymentInput: CashFlowDebtPaymentInput[] = [],
  openingBalanceInput = 0,
): CashFlowIntelligenceResult {
  const data = normalizeCashFlowIntelligenceInputs(input);
  const debtPayments = normalizeCashFlowDebtPayments(debtPaymentInput);
  const health = calculateFinancialHealth(data.financialHealth);
  const months = data.monthly.slice(-12);
  const currentMonth = months.at(-1) ?? normalizeMonth(null);
  const openingBalance = round(finite(openingBalanceInput));
  const incomeWithStartBalance = round(
    currentMonth.income + openingBalance,
  );
  const recentMonths = months.slice(-3);
  const priorMonths = months.slice(-6, -3);
  const activeMonths = months.filter((month) => month.transactionCount > 0);
  const currentMonthKey =
    currentMonth.month || monthKey(data.generatedAt) || monthKey(new Date().toISOString());
  const adjustedCommitments = adjustCommitments(
    data.commitments,
    debtPayments,
    currentMonthKey,
  );

  const averageMonthlyIncome = average(recentMonths.map((month) => month.income));
  const averageMonthlyOutflow = average(recentMonths.map((month) => month.outflow));
  const recentNetAverage = average(recentMonths.map((month) => month.netCashFlow));
  const priorNetAverage = average(priorMonths.map((month) => month.netCashFlow));
  const trendChange = round(recentNetAverage - priorNetAverage);
  const trendPercent =
    Math.abs(priorNetAverage) > 0.01
      ? (trendChange / Math.abs(priorNetAverage)) * 100
      : null;

  const availableNow = round(currentMonth.netCashFlow + openingBalance);
  const stillToPay = round(adjustedCommitments.total);
  const leftAfterPayments = round(availableNow - stillToPay);
  const projectedMargin =
    Math.abs(availableNow) > 0.01 ? leftAfterPayments / Math.abs(availableNow) : 0;
  const commitmentRatio =
    availableNow > 0
      ? stillToPay / availableNow
      : stillToPay > 0
        ? 1
        : 0;

  const netValues = activeMonths.map((month) => month.netCashFlow);
  const volatility =
    averageMonthlyIncome > 0
      ? standardDeviation(netValues) / averageMonthlyIncome
      : 0;
  const lastSixMonths = months.slice(-6);
  const incomeConsistency = lastSixMonths.length
    ? lastSixMonths.filter((month) => month.income > 0).length / lastSixMonths.length
    : 0;

  const recentCategoryTotal = data.categories.reduce(
    (sum, category) => sum + category.recentAmount,
    0,
  );
  const categories: CashFlowCategory[] = data.categories
    .map((category) => ({
      ...category,
      share:
        recentCategoryTotal > 0 ? category.recentAmount / recentCategoryTotal : 0,
      changePercent:
        category.priorAmount > 0
          ? ((category.recentAmount - category.priorAmount) / category.priorAmount) * 100
          : category.recentAmount > 0
            ? null
            : 0,
    }))
    .sort((a, b) => b.recentAmount - a.recentAmount)
    .slice(0, 6);

  const forecastAvailable =
    currentMonth.transactionCount > 0 ||
    Math.abs(availableNow) > 0.01 ||
    stillToPay > 0;
  const label = forecastAvailable
    ? outlookLabel(leftAfterPayments, projectedMargin, commitmentRatio)
    : "Not enough data";

  const insights: CashFlowInsight[] = [];
  if (!forecastAvailable) {
    insights.push({
      id: "no-data",
      title: "Cash flow is waiting for records",
      detail: "No current balance or unpaid commitment is available yet.",
      action: "Add income, expenses, bills or debt payments to activate this view.",
      tone: "info",
    });
  } else if (leftAfterPayments < 0) {
    insights.push({
      id: "shortfall",
      title: "Scheduled payments are above the amount available now",
      detail: `The listed unpaid commitments create an expected shortfall of ${Math.abs(
        leftAfterPayments,
      ).toLocaleString("en-US", { style: "currency", currency: "EUR" })}.`,
      action: "Review the unpaid breakdown and adjust payment dates or spending.",
      tone: "critical",
    });
  } else {
    insights.push({
      id: "covered",
      title: "The listed scheduled payments are covered",
      detail: `${leftAfterPayments.toLocaleString("en-US", {
        style: "currency",
        currency: "EUR",
      })} is expected to remain after the unpaid commitments shown here.`,
      action: "Keep transactions and payment statuses current so this amount stays accurate.",
      tone: leftAfterPayments > availableNow * 0.2 ? "positive" : "warning",
    });
  }

  if (adjustedCommitments.paidDebtMinimumsThisMonth > 0) {
    insights.push({
      id: "paid-minimums-excluded",
      title: "Recorded debt payments are not counted twice",
      detail: `${adjustedCommitments.paidDebtMinimumsThisMonth.toLocaleString("en-US", {
        style: "currency",
        currency: "EUR",
      })} of this month's debt minimums has already been recorded and removed from Still to pay.`,
      action: "No manual adjustment is needed for those recorded payments.",
      tone: "info",
    });
  }

  const topCategory = categories[0];
  if (topCategory && topCategory.share >= 0.3) {
    insights.push({
      id: "category-concentration",
      title: `${topCategory.category} is the largest recent spending category`,
      detail: `${round(topCategory.share * 100, 1)}% of recent expense activity is concentrated in this category.`,
      action: "Review this category first when looking for additional room.",
      tone: topCategory.share >= 0.45 ? "warning" : "info",
    });
  }

  if (priorMonths.length && trendChange > 0) {
    insights.push({
      id: "improving-trend",
      title: "Recent cash-flow momentum is improving",
      detail: `The latest three-month average is ${trendChange.toLocaleString("en-US", {
        style: "currency",
        currency: "EUR",
      })} better than the preceding three months.`,
      action: "Preserve the improvement and avoid allowing fixed costs to absorb it.",
      tone: "positive",
    });
  }

  if (!insights.length) {
    insights.push({
      id: "building-history",
      title: "Cash-flow history is still building",
      detail: "More recorded months will improve the trend and consistency information.",
      action: "Keep Transactions and Bills current.",
      tone: "info",
    });
  }

  const historyCoverage = clamp(activeMonths.length / 6, 0, 1) * 45;
  const categoryCoverage = categories.length ? 20 : 0;
  const commitmentCoverage = adjustedCommitments.items.length ? 20 : 0;
  const healthCoverage = health.dataCoverage * 0.15;
  const dataCoverage = forecastAvailable
    ? Math.round(
        clamp(
          historyCoverage + categoryCoverage + commitmentCoverage + healthCoverage,
          0,
          100,
        ),
      )
    : 0;
  const confidence = confidenceFor(dataCoverage);

  const summary = !forecastAvailable
    ? "Add financial activity to calculate what is available and what will remain after scheduled payments."
    : leftAfterPayments < 0
      ? "The listed unpaid bills and debt minimums are higher than the amount currently available."
      : "This amount starts from what is available now and subtracts only the bills and debt minimums that are still unpaid.";

  return {
    version: "1.0",
    label,
    summary,
    confidence,
    dataCoverage,
    forecastAvailable,
    nextBestAction: insights[0]?.action ?? "Keep financial records current.",
    health,
    metrics: {
      currentMonthIncome: incomeWithStartBalance,
      currentMonthExpenses: currentMonth.expenses,
      currentMonthSavings: currentMonth.savings,
      currentMonthOutflow: currentMonth.outflow,
      currentMonthNetCashFlow: availableNow,
      averageMonthlyIncome,
      averageMonthlyOutflow,
      averageMonthlyNetCashFlow: recentNetAverage,
      expectedIncome: incomeWithStartBalance,
      expectedOutflow: stillToPay,
      projectedNetCashFlow: leftAfterPayments,
      projectedMargin,
      knownCommitments: stillToPay,
      commitmentRatio,
      recentNetAverage,
      priorNetAverage,
      trendChange,
      trendPercent,
      volatility,
      incomeConsistency,
      availableNow,
      stillToPay,
      leftAfterPayments,
      paidDebtMinimumsThisMonth:
        adjustedCommitments.paidDebtMinimumsThisMonth,
    },
    monthly: months,
    categories,
    commitments: {
      total: adjustedCommitments.total,
      billsTotal: adjustedCommitments.billsTotal,
      debtMinimums: adjustedCommitments.debtMinimums,
      items: adjustedCommitments.items,
    },
    insights: insights.slice(0, 5),
  };
}
