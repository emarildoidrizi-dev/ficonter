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

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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

function outlookLabel(
  projectedNetCashFlow: number,
  projectedMargin: number,
  commitmentRatio: number,
): CashFlowOutlookLabel {
  if (projectedNetCashFlow < 0) return "Negative";
  if (projectedMargin < 0.08 || commitmentRatio > 0.7) return "Tight";
  if (projectedMargin < 0.2 || commitmentRatio > 0.45) return "Positive";
  return "Strong";
}

function confidenceFor(coverage: number): CashFlowIntelligenceResult["confidence"] {
  if (coverage <= 0) return "No data";
  if (coverage >= 75) return "High";
  if (coverage >= 45) return "Moderate";
  return "Developing";
}

export function calculateCashFlowIntelligence(
  input: CashFlowIntelligenceInputs = EMPTY_INPUTS,
): CashFlowIntelligenceResult {
  const data = normalizeCashFlowIntelligenceInputs(input);
  const health = calculateFinancialHealth(data.financialHealth);
  const months = data.monthly.slice(-12);
  const currentMonth = months.at(-1) ?? normalizeMonth(null);
  const recentMonths = months.slice(-3);
  const priorMonths = months.slice(-6, -3);
  const activeMonths = months.filter((month) => month.transactionCount > 0);
  const plannerHasData =
    data.planner.plannedIncome > 0 || data.planner.plannedOutflow > 0;
  const commitmentsHaveData =
    data.commitments.items.some((item) => item.amount > 0) ||
    data.commitments.total > 0;
  const forecastAvailable =
    activeMonths.length > 0 || plannerHasData || commitmentsHaveData;

  const averageMonthlyIncome = average(recentMonths.map((month) => month.income));
  const averageMonthlyOutflow = average(recentMonths.map((month) => month.outflow));
  const recentNetAverage = average(recentMonths.map((month) => month.netCashFlow));
  const priorNetAverage = average(priorMonths.map((month) => month.netCashFlow));
  const trendChange = recentNetAverage - priorNetAverage;
  const trendPercent =
    Math.abs(priorNetAverage) > 0.01
      ? (trendChange / Math.abs(priorNetAverage)) * 100
      : null;

  const expectedIncome = Math.max(
    currentMonth.income,
    data.planner.plannedIncome,
    averageMonthlyIncome,
  );
  const expectedOutflow = Math.max(
    currentMonth.outflow,
    data.planner.plannedOutflow,
    averageMonthlyOutflow,
    data.commitments.total,
  );
  const projectedNetCashFlow = expectedIncome - expectedOutflow;
  const projectedMargin = expectedIncome > 0 ? projectedNetCashFlow / expectedIncome : 0;
  const commitmentRatio =
    expectedIncome > 0
      ? data.commitments.total / expectedIncome
      : data.commitments.total > 0
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

  const label = forecastAvailable
    ? outlookLabel(projectedNetCashFlow, projectedMargin, commitmentRatio)
    : "Not enough data";
  const topCategory = categories[0];
  const insights: CashFlowInsight[] = [];

  if (!forecastAvailable) {
    insights.push({
      id: "no-data",
      title: "Cash-flow outlook is waiting for records",
      detail: "No income, outflow, commitment or planner amount is available for forecasting yet.",
      action: "Record the first income or outflow to activate Cash Flow Intelligence.",
      tone: "info",
    });
  } else if (projectedNetCashFlow < 0) {
    insights.push({
      id: "negative-outlook",
      title: "Projected outflow is above expected income",
      detail: `The current estimate is short by ${Math.abs(projectedNetCashFlow).toLocaleString("en-US", {
        style: "currency",
        currency: "EUR",
      })} over the next monthly cycle.`,
      action: "Reduce flexible outflow or update expected income in Monthly Planner.",
      tone: "critical",
    });
  } else if (projectedMargin >= 0.2) {
    insights.push({
      id: "healthy-margin",
      title: "Your expected cash-flow margin is strong",
      detail: `${round(projectedMargin * 100)}% of expected income remains after the conservative outflow estimate.`,
      action: "Protect this margin and direct it toward savings, debt reduction or goals.",
      tone: "positive",
    });
  }

  if (commitmentRatio > 0.5) {
    insights.push({
      id: "commitment-pressure",
      title: "Known commitments use a large share of expected income",
      detail: `${round(commitmentRatio * 100)}% of expected income is represented by upcoming bills and minimum debt payments.`,
      action: "Review recurring obligations before adding new fixed commitments.",
      tone: commitmentRatio > 0.75 ? "critical" : "warning",
    });
  }

  if (topCategory && topCategory.share >= 0.3) {
    insights.push({
      id: "category-concentration",
      title: `${topCategory.category} is the largest spending pressure`,
      detail: `${round(topCategory.share * 100)}% of expense activity from the last 90 days is concentrated in this category.`,
      action: "Review this category first when looking for meaningful cash-flow improvements.",
      tone: topCategory.share >= 0.45 ? "warning" : "info",
    });
  }

  if (activeMonths.length >= 4 && volatility > 0.3) {
    insights.push({
      id: "volatile-flow",
      title: "Monthly cash flow is fluctuating materially",
      detail: `Cash-flow volatility is ${round(volatility * 100)}% relative to recent average income.`,
      action: "Use a larger monthly buffer and plan around lower-income or higher-expense months.",
      tone: "warning",
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

  if (forecastAvailable && !plannerHasData) {
    insights.push({
      id: "planner-gap",
      title: "The forecast is relying mainly on recorded history",
      detail: "No current-month plan is available to refine expected income and outflow.",
      action: "Complete Monthly Planner to make the outlook more precise.",
      tone: "info",
    });
  }

  if (!insights.length) {
    insights.push({
      id: "building-history",
      title: "Cash-flow intelligence is building its history",
      detail: "More recorded months will improve trend, volatility and forecast confidence.",
      action: "Keep Transactions, Bills and Monthly Planner current.",
      tone: "info",
    });
  }

  const prioritized = [...insights].sort((a, b) => {
    const order: Record<CashFlowInsightTone, number> = {
      critical: 0,
      warning: 1,
      info: 2,
      positive: 3,
    };
    return order[a.tone] - order[b.tone];
  });

  const historyCoverage = clamp(activeMonths.length / 6, 0, 1) * 35;
  const plannerCoverage = plannerHasData ? 20 : 0;
  const categoryCoverage = categories.length ? 15 : 0;
  const commitmentCoverage = data.commitments.items.length ? 15 : 0;
  const healthCoverage = health.dataCoverage * 0.15;
  const dataCoverage = forecastAvailable
    ? Math.round(
        clamp(
          historyCoverage +
            plannerCoverage +
            categoryCoverage +
            commitmentCoverage +
            healthCoverage,
          0,
          100,
        ),
      )
    : 0;
  const confidence = confidenceFor(dataCoverage);

  const summary = !forecastAvailable
    ? "No cash-flow records are available yet. Add income, outflow, bills, debt minimums or planner amounts to begin forecasting."
    : label === "Negative"
        ? "Expected outflow is currently above expected income. Known commitments and spending pressure should be reviewed first."
        : label === "Tight"
          ? "Cash flow remains positive, but the forecast leaves limited room for unexpected costs."
          : label === "Positive"
            ? "Cash flow is positive with a usable margin, although selected commitments or spending categories still require attention."
            : "Cash flow is strong, positive and supported by a healthy projected margin.";

  return {
    version: "1.0",
    label,
    summary,
    confidence,
    dataCoverage,
    forecastAvailable,
    nextBestAction: prioritized[0]?.action ?? "Keep financial records current.",
    health,
    metrics: {
      currentMonthIncome: currentMonth.income,
      currentMonthExpenses: currentMonth.expenses,
      currentMonthSavings: currentMonth.savings,
      currentMonthOutflow: currentMonth.outflow,
      currentMonthNetCashFlow: currentMonth.netCashFlow,
      averageMonthlyIncome,
      averageMonthlyOutflow,
      averageMonthlyNetCashFlow: recentNetAverage,
      expectedIncome,
      expectedOutflow,
      projectedNetCashFlow,
      projectedMargin,
      knownCommitments: data.commitments.total,
      commitmentRatio,
      recentNetAverage,
      priorNetAverage,
      trendChange,
      trendPercent,
      volatility,
      incomeConsistency,
    },
    monthly: months,
    categories,
    commitments: data.commitments,
    insights: insights.slice(0, 5),
  };
}
