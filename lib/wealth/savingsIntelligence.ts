import {
  calculateCashFlowIntelligence,
  normalizeCashFlowIntelligenceInputs,
  type CashFlowIntelligenceInputs,
  type CashFlowIntelligenceResult,
  type CashFlowMonth,
} from "@/lib/wealth/cashFlowIntelligence";

export type SavingsCategoryInput = {
  category: string;
  amount: number;
  contributionCount: number;
  latestAt: string | null;
};

export type SavingsContribution = {
  id: string;
  description: string;
  category: string;
  amount: number;
  occurredAt: string;
};

export type SavingsIntelligenceInputs = {
  schemaVersion: number;
  generatedAt: string;
  cashFlow: CashFlowIntelligenceInputs;
  categories: SavingsCategoryInput[];
  recentSavings: SavingsContribution[];
  stats: {
    contributionCount: number;
    firstContributionAt: string | null;
    lastContributionAt: string | null;
  };
};

export type SavingsRhythmStatus =
  | "Strong rhythm"
  | "Steady"
  | "Building"
  | "Irregular"
  | "Not started"
  | "Set baseline";

export type SavingsInsightTone = "positive" | "info" | "warning" | "critical";

export type SavingsInsight = {
  id: string;
  tone: SavingsInsightTone;
  title: string;
  detail: string;
  action: string;
};

export type SavingsCategory = SavingsCategoryInput & {
  share: number;
};

export type SavingsMonthHighlight = {
  month: string;
  amount: number;
};

export type SavingsIntelligenceResult = {
  version: "1.0";
  status: SavingsRhythmStatus;
  summary: string;
  confidence: "High" | "Moderate" | "Developing";
  dataCoverage: number;
  nextBestAction: string;
  cashFlow: CashFlowIntelligenceResult;
  metrics: {
    totalSaved: number;
    savingsRate: number;
    currentMonthSavings: number;
    averageMonthlySavings3Months: number;
    averageMonthlySavings6Months: number;
    recommendedMonthlyTarget: number;
    recommendedTargetRate: number;
    monthlyGap: number;
    annualForecast: number;
    recommendedAnnualTarget: number;
    progressToTarget: number;
    consistencyRate: number;
    savingMonths: number;
    activeMonths: number;
    currentStreak: number;
    recentTrendChange: number;
    recentTrendPercent: number | null;
    surplusBeforeSavings: number;
    emergencyFundShare: number;
    goalSavingsShare: number;
    categoryCount: number;
  };
  monthly: CashFlowMonth[];
  categories: SavingsCategory[];
  recentSavings: SavingsContribution[];
  bestMonth: SavingsMonthHighlight | null;
  weakestMonth: SavingsMonthHighlight | null;
  insights: SavingsInsight[];
};

const EMPTY_INPUTS: SavingsIntelligenceInputs = {
  schemaVersion: 1,
  generatedAt: new Date(0).toISOString(),
  cashFlow: normalizeCashFlowIntelligenceInputs(null),
  categories: [],
  recentSavings: [],
  stats: {
    contributionCount: 0,
    firstContributionAt: null,
    lastContributionAt: null,
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

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
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

function activeMonth(month: CashFlowMonth): boolean {
  return (
    month.transactionCount > 0 ||
    month.income > 0 ||
    month.expenses > 0 ||
    month.savings > 0
  );
}

function normalizeCategory(value: unknown): SavingsCategoryInput {
  const row = object(value);
  return {
    category: text(row.category, "General savings") || "General savings",
    amount: Math.max(0, finite(row.amount)),
    contributionCount: integer(row.contributionCount),
    latestAt: nullableText(row.latestAt),
  };
}

function normalizeContribution(value: unknown): SavingsContribution | null {
  const row = object(value);
  const id = text(row.id);
  if (!id) return null;

  return {
    id,
    description: text(row.description, "Saving contribution") || "Saving contribution",
    category: text(row.category, "General savings") || "General savings",
    amount: Math.max(0, finite(row.amount)),
    occurredAt: text(row.occurredAt),
  };
}

export function normalizeSavingsIntelligenceInputs(
  value: unknown,
): SavingsIntelligenceInputs {
  const root = object(value);
  const stats = object(root.stats);

  return {
    schemaVersion: integer(root.schemaVersion) || 1,
    generatedAt: text(root.generatedAt, new Date().toISOString()),
    cashFlow: normalizeCashFlowIntelligenceInputs(root.cashFlow),
    categories: array(root.categories).map(normalizeCategory),
    recentSavings: array(root.recentSavings)
      .map(normalizeContribution)
      .filter((item): item is SavingsContribution => Boolean(item)),
    stats: {
      contributionCount: integer(stats.contributionCount),
      firstContributionAt: nullableText(stats.firstContributionAt),
      lastContributionAt: nullableText(stats.lastContributionAt),
    },
  };
}

function confidenceFor(coverage: number): SavingsIntelligenceResult["confidence"] {
  if (coverage >= 75) return "High";
  if (coverage >= 45) return "Moderate";
  return "Developing";
}

function rhythmStatus(
  totalSaved: number,
  averageMonthlyIncome: number,
  activeMonths: number,
  consistencyRate: number,
  progressToTarget: number,
): SavingsRhythmStatus {
  if (totalSaved <= 0) return "Not started";
  if (averageMonthlyIncome <= 0) return "Set baseline";
  if (activeMonths < 2) return "Building";
  if (consistencyRate >= 0.8 && progressToTarget >= 90) return "Strong rhythm";
  if (consistencyRate >= 0.65) return "Steady";
  if (consistencyRate >= 0.35) return "Building";
  return "Irregular";
}

function currentSavingStreak(months: CashFlowMonth[]): number {
  const active = months.filter(activeMonth);
  let streak = 0;

  for (let index = active.length - 1; index >= 0; index -= 1) {
    if (active[index].savings <= 0) break;
    streak += 1;
  }

  return streak;
}

export function calculateSavingsIntelligence(
  input: SavingsIntelligenceInputs = EMPTY_INPUTS,
): SavingsIntelligenceResult {
  const data = normalizeSavingsIntelligenceInputs(input);
  const cashFlow = calculateCashFlowIntelligence(data.cashFlow);
  const health = cashFlow.health;
  const months = data.cashFlow.monthly.slice(-12);
  const currentMonth = months.at(-1) ?? {
    month: "",
    transactionCount: 0,
    income: 0,
    expenses: 0,
    savings: 0,
    outflow: 0,
    netCashFlow: 0,
  };
  const activeMonths = months.filter(activeMonth);
  const savingMonths = activeMonths.filter((month) => month.savings > 0);
  const recentThree = months.slice(-3).filter(activeMonth);
  const priorThree = months.slice(-6, -3).filter(activeMonth);
  const recentSix = months.slice(-6).filter(activeMonth);

  const totalSaved = health.metrics.totalSavings;
  const savingsRate = health.metrics.savingsRate;
  const averageMonthlySavings3Months = average(
    recentThree.map((month) => month.savings),
  );
  const averageMonthlySavings6Months = average(
    recentSix.map((month) => month.savings),
  );
  const priorThreeAverage = average(priorThree.map((month) => month.savings));
  const recentTrendChange = averageMonthlySavings3Months - priorThreeAverage;
  const recentTrendPercent =
    priorThreeAverage > 0.01
      ? (recentTrendChange / priorThreeAverage) * 100
      : averageMonthlySavings3Months > 0
        ? null
        : 0;

  const averageMonthlyIncome = health.metrics.averageMonthlyIncome;
  const averageMonthlyExpenses = health.metrics.averageMonthlyExpenses;
  const surplusBeforeSavings = Math.max(
    0,
    averageMonthlyIncome - averageMonthlyExpenses,
  );

  let recommendedTargetRate = 0.2;
  if (health.metrics.netCashFlow <= 0 || health.metrics.overdueBills > 0) {
    recommendedTargetRate = 0.1;
  } else if (health.metrics.debtServiceRatio > 0.25) {
    recommendedTargetRate = 0.15;
  }

  const rateTarget = averageMonthlyIncome * recommendedTargetRate;
  const sustainableCapacity = surplusBeforeSavings * 0.75;
  const recommendedMonthlyTarget =
    averageMonthlyIncome > 0 && sustainableCapacity > 0
      ? Math.min(rateTarget, sustainableCapacity)
      : 0;
  const monthlyGap = Math.max(
    0,
    recommendedMonthlyTarget - averageMonthlySavings3Months,
  );
  const progressToTarget =
    recommendedMonthlyTarget > 0
      ? clamp(
          (averageMonthlySavings3Months / recommendedMonthlyTarget) * 100,
          0,
          200,
        )
      : 0;
  const annualForecast = averageMonthlySavings3Months * 12;
  const recommendedAnnualTarget = recommendedMonthlyTarget * 12;
  const consistencyRate = activeMonths.length
    ? savingMonths.length / activeMonths.length
    : 0;
  const currentStreak = currentSavingStreak(months);

  const categoryTotal = data.categories.reduce(
    (sum, category) => sum + category.amount,
    0,
  );
  const categories: SavingsCategory[] = data.categories
    .map((category) => ({
      ...category,
      share: categoryTotal > 0 ? category.amount / categoryTotal : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));

  const emergencyFundAmount = categories
    .filter((category) => category.category.toLowerCase() === "emergency fund")
    .reduce((sum, category) => sum + category.amount, 0);
  const goalSavingsAmount = categories
    .filter((category) => category.category.toLowerCase() === "goal investments")
    .reduce((sum, category) => sum + category.amount, 0);
  const emergencyFundShare = totalSaved > 0 ? emergencyFundAmount / totalSaved : 0;
  const goalSavingsShare = totalSaved > 0 ? goalSavingsAmount / totalSaved : 0;

  const highlightedMonths = activeMonths.length ? activeMonths : months;
  const bestMonth = highlightedMonths.length
    ? highlightedMonths.reduce((best, month) =>
        month.savings > best.savings ? month : best,
      )
    : null;
  const weakestMonth = highlightedMonths.length
    ? highlightedMonths.reduce((weakest, month) =>
        month.savings < weakest.savings ? month : weakest,
      )
    : null;

  const status = rhythmStatus(
    totalSaved,
    averageMonthlyIncome,
    activeMonths.length,
    consistencyRate,
    progressToTarget,
  );

  const insights: SavingsInsight[] = [];

  if (totalSaved <= 0) {
    insights.push({
      id: "start-saving",
      tone: "critical",
      title: "No saving contributions are recorded yet",
      detail:
        "Savings Intelligence becomes meaningful once at least one General Saving transaction is recorded.",
      action: "Record a first sustainable saving contribution in Transactions.",
    });
  } else if (recommendedMonthlyTarget > 0 && monthlyGap > 0) {
    insights.push({
      id: "target-gap",
      tone: monthlyGap > recommendedMonthlyTarget * 0.5 ? "warning" : "info",
      title: "Your recent saving pace is below the sustainable target",
      detail: `The latest three-month pace is €${round(
        averageMonthlySavings3Months,
      ).toLocaleString("en-US")} per month, leaving a €${round(
        monthlyGap,
      ).toLocaleString("en-US")} monthly gap.`,
      action: "Increase the next recurring saving contribution by a manageable amount.",
    });
  } else if (recommendedMonthlyTarget > 0 && progressToTarget >= 100) {
    insights.push({
      id: "target-reached",
      tone: "positive",
      title: "Your recent saving pace meets the recommended target",
      detail: `The current pace is ${round(progressToTarget)}% of the sustainable monthly target.`,
      action: "Maintain the pace and direct contributions toward your highest-priority category.",
    });
  }

  if (activeMonths.length >= 3 && consistencyRate < 0.5) {
    insights.push({
      id: "inconsistent-saving",
      tone: "warning",
      title: "Saving activity is irregular",
      detail: `Savings were recorded in ${savingMonths.length} of ${activeMonths.length} active months.`,
      action: "Use a recurring monthly contribution to make saving more consistent.",
    });
  } else if (activeMonths.length >= 3 && consistencyRate >= 0.75) {
    insights.push({
      id: "consistent-saving",
      tone: "positive",
      title: "Your saving rhythm is consistent",
      detail: `Savings were recorded in ${round(consistencyRate * 100)}% of active months.`,
      action: "Protect the habit and review the amount whenever income changes.",
    });
  }

  if (priorThree.length && recentTrendChange < 0) {
    insights.push({
      id: "declining-pace",
      tone: "warning",
      title: "Recent saving momentum has slowed",
      detail: `The latest three-month average is €${round(
        Math.abs(recentTrendChange),
      ).toLocaleString("en-US")} lower than the preceding three months.`,
      action: "Review recent outflow and restore part of the previous saving pace.",
    });
  } else if (priorThree.length && recentTrendChange > 0) {
    insights.push({
      id: "improving-pace",
      tone: "positive",
      title: "Recent saving momentum is improving",
      detail: `The latest three-month average is €${round(
        recentTrendChange,
      ).toLocaleString("en-US")} higher than the preceding three months.`,
      action: "Keep the increase sustainable rather than relying on one exceptional month.",
    });
  }

  if (
    health.metrics.emergencyFundCoverageMonths < 3 &&
    emergencyFundShare < 0.35 &&
    totalSaved > 0
  ) {
    insights.push({
      id: "reserve-priority",
      tone: "info",
      title: "Emergency protection remains a priority",
      detail: `${round(
        emergencyFundShare * 100,
      )}% of recorded savings is assigned to Emergency fund while coverage is below three months.`,
      action: "Direct part of the next saving contribution to the Emergency fund category.",
    });
  }

  const topCategory = categories[0];
  if (topCategory && topCategory.share >= 0.75 && categories.length > 1) {
    insights.push({
      id: "category-concentration",
      tone: "info",
      title: `Most savings are concentrated in ${topCategory.category}`,
      detail: `${round(topCategory.share * 100)}% of recorded savings is assigned to this category.`,
      action: "Confirm that this concentration matches your current financial priorities.",
    });
  }

  if (!insights.length) {
    insights.push({
      id: "building-history",
      tone: "info",
      title: "Savings Intelligence is building its history",
      detail:
        "More monthly saving records will improve consistency, trend and forecast confidence.",
      action: "Keep recording saving contributions with accurate categories.",
    });
  }

  const tonePriority: Record<SavingsInsightTone, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    positive: 3,
  };
  const prioritized = [...insights].sort(
    (a, b) => tonePriority[a.tone] - tonePriority[b.tone],
  );

  const historyCoverage = clamp(activeMonths.length / 6, 0, 1) * 35;
  const categoryCoverage = categories.length ? 20 : 0;
  const contributionCoverage = clamp(data.stats.contributionCount / 6, 0, 1) * 15;
  const sourceCoverage = cashFlow.dataCoverage * 0.3;
  const dataCoverage = Math.round(
    clamp(
      historyCoverage + categoryCoverage + contributionCoverage + sourceCoverage,
      0,
      100,
    ),
  );
  const confidence = confidenceFor(dataCoverage);

  const summary =
    status === "Not started"
      ? "Record a first saving contribution to activate savings trends, categories and forecasts."
      : status === "Set baseline"
        ? "Savings exist, but regular income history is needed before FICONTER can recommend a sustainable monthly target."
        : status === "Irregular"
          ? "Savings are accumulating, but contributions are not yet consistent enough to create a dependable rhythm."
          : status === "Building"
            ? "A saving habit is forming. Consistency and a clear monthly target are the next priorities."
            : status === "Steady"
              ? "Savings are being recorded with a stable rhythm, supported by measurable monthly progress."
              : "Savings are consistent and the recent pace is meeting the sustainable monthly recommendation.";

  return {
    version: "1.0",
    status,
    summary,
    confidence,
    dataCoverage,
    nextBestAction: prioritized[0]?.action ?? "Keep savings records current.",
    cashFlow,
    metrics: {
      totalSaved,
      savingsRate,
      currentMonthSavings: currentMonth.savings,
      averageMonthlySavings3Months,
      averageMonthlySavings6Months,
      recommendedMonthlyTarget,
      recommendedTargetRate,
      monthlyGap,
      annualForecast,
      recommendedAnnualTarget,
      progressToTarget,
      consistencyRate,
      savingMonths: savingMonths.length,
      activeMonths: activeMonths.length,
      currentStreak,
      recentTrendChange,
      recentTrendPercent,
      surplusBeforeSavings,
      emergencyFundShare,
      goalSavingsShare,
      categoryCount: categories.length,
    },
    monthly: months,
    categories,
    recentSavings: data.recentSavings,
    bestMonth: bestMonth
      ? { month: bestMonth.month, amount: bestMonth.savings }
      : null,
    weakestMonth: weakestMonth
      ? { month: weakestMonth.month, amount: weakestMonth.savings }
      : null,
    insights: insights.slice(0, 5),
  };
}
