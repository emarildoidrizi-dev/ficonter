import {
  AVERAGE_PERIODS,
  averageMonthlyFromSeries,
  type AveragePeriod,
} from "@/lib/wealth/averagePeriods";
import {
  calculateFinancialHealth,
  normalizeFinancialHealthInputs,
  type FinancialHealthInputs,
} from "@/lib/wealth/financialHealth";

export type EmergencyFundMonth = {
  month: string;
  contributionCount: number;
  contribution: number;
};

export type EmergencyFundContribution = {
  id: string;
  description: string;
  amount: number;
  occurredAt: string;
};

export type EmergencyFundInputs = {
  schemaVersion: number;
  generatedAt: string;
  financialHealth: FinancialHealthInputs;
  monthly: EmergencyFundMonth[];
  recentContributions: EmergencyFundContribution[];
  stats: {
    contributionCount: number;
    lastContributionAt: string | null;
  };
};

export type EmergencyFundStatus =
  | "Not started"
  | "Starting"
  | "Building"
  | "Foundation ready"
  | "Strong reserve"
  | "Set baseline";

export type EmergencyFundConfidence =
  | "High"
  | "Moderate"
  | "Developing"
  | "No data";

export type EmergencyFundInsightTone =
  | "positive"
  | "info"
  | "warning"
  | "critical";

export type EmergencyFundInsight = {
  id: string;
  tone: EmergencyFundInsightTone;
  title: string;
  description: string;
};

export type EmergencyFundMilestone = {
  months: number;
  label: string;
  target: number;
  progress: number;
  remaining: number;
  reached: boolean;
};

export type EmergencyFundResult = {
  version: "2.0";
  status: EmergencyFundStatus;
  summary: string;
  confidence: EmergencyFundConfidence;
  dataCoverage: number;
  nextBestAction: string;
  recommendedTargetMonths: 3 | 6;
  metrics: {
    currentBalance: number;
    averageMonthlyExpenses: number;
    averageMonthlyIncome: number;
    coverageMonths: number;
    foundationTarget: number;
    strongTarget: number;
    recommendedTarget: number;
    recommendedGap: number;
    foundationProgress: number;
    strongProgress: number;
    recommendedProgress: number;
    currentMonthContribution: number;
    averageContribution3Months: number;
    averageContribution6Months: number;
    averageContribution9Months: number;
    averageContribution12Months: number;
    averageContributions: Record<AveragePeriod, number>;
    suggestedMonthlyContribution: number;
    monthsToRecommendedTarget: number | null;
    estimatedCompletionDate: string | null;
    incomeStability: number;
  };
  milestones: EmergencyFundMilestone[];
  monthly: EmergencyFundMonth[];
  recentContributions: EmergencyFundContribution[];
  insights: EmergencyFundInsight[];
};

const EMPTY_INPUTS: EmergencyFundInputs = {
  schemaVersion: 1,
  generatedAt: new Date(0).toISOString(),
  financialHealth: normalizeFinancialHealthInputs(null),
  monthly: [],
  recentContributions: [],
  stats: {
    contributionCount: 0,
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundToFive(value: number): number {
  if (value <= 0) return 0;
  return Math.max(5, Math.round(value / 5) * 5);
}

function addMonths(value: string, monthCount: number): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCMonth(parsed.getUTCMonth() + monthCount);
  return parsed.toISOString();
}

function confidenceFor(coverage: number): EmergencyFundConfidence {
  if (coverage <= 0) return "No data";
  if (coverage >= 75) return "High";
  if (coverage >= 45) return "Moderate";
  return "Developing";
}

function statusFor(
  coverageMonths: number,
  averageMonthlyExpenses: number,
): EmergencyFundStatus {
  if (averageMonthlyExpenses <= 0) return "Set baseline";
  if (coverageMonths >= 6) return "Strong reserve";
  if (coverageMonths >= 3) return "Foundation ready";
  if (coverageMonths >= 1) return "Building";
  if (coverageMonths > 0) return "Starting";
  return "Not started";
}

export function normalizeEmergencyFundInputs(value: unknown): EmergencyFundInputs {
  const root = object(value);
  const stats = object(root.stats);

  const monthly = array(root.monthly).map((entry) => {
    const row = object(entry);
    return {
      month: typeof row.month === "string" ? row.month : "",
      contributionCount: integer(row.contributionCount),
      contribution: Math.max(0, finite(row.contribution)),
    };
  });

  const recentContributions = array(root.recentContributions).map((entry) => {
    const row = object(entry);
    return {
      id: typeof row.id === "string" ? row.id : "",
      description:
        typeof row.description === "string" && row.description.trim()
          ? row.description.trim()
          : "Emergency fund saving",
      amount: Math.max(0, finite(row.amount)),
      occurredAt:
        typeof row.occurredAt === "string"
          ? row.occurredAt
          : new Date(0).toISOString(),
    };
  });

  return {
    schemaVersion: integer(root.schemaVersion) || 1,
    generatedAt:
      typeof root.generatedAt === "string"
        ? root.generatedAt
        : new Date().toISOString(),
    financialHealth: normalizeFinancialHealthInputs(root.financialHealth),
    monthly,
    recentContributions,
    stats: {
      contributionCount: integer(stats.contributionCount),
      lastContributionAt:
        typeof stats.lastContributionAt === "string"
          ? stats.lastContributionAt
          : null,
    },
  };
}

export function calculateEmergencyFund(
  input: EmergencyFundInputs = EMPTY_INPUTS,
): EmergencyFundResult {
  const data = normalizeEmergencyFundInputs(input);
  const health = calculateFinancialHealth(data.financialHealth);
  const healthInputs = data.financialHealth;

  const currentBalance = Math.max(
    0,
    healthInputs.transactions.emergencyFundSavings,
  );
  const averageMonthlyExpenses = Math.max(
    0,
    health.metrics.averageMonthlyExpenses,
  );
  const averageMonthlyIncome = Math.max(0, health.metrics.averageMonthlyIncome);
  const coverageMonths =
    averageMonthlyExpenses > 0
      ? currentBalance / averageMonthlyExpenses
      : 0;

  const activeMonths = Math.max(healthInputs.transactions.activeMonths, 1);
  const incomeMonths = healthInputs.transactions.incomeMonths;
  const incomeStability = clamp(incomeMonths / activeMonths, 0, 1);

  const foundationTarget = averageMonthlyExpenses * 3;
  const strongTarget = averageMonthlyExpenses * 6;
  const recommendedTargetMonths: 3 | 6 =
    incomeStability < 0.8 ||
    healthInputs.debts.activeCount > 0 ||
    healthInputs.bills.overdueCount > 0
      ? 6
      : 3;
  const recommendedTarget =
    recommendedTargetMonths === 6 ? strongTarget : foundationTarget;
  const recommendedGap = Math.max(0, recommendedTarget - currentBalance);

  const monthlyValues = data.monthly.map((month) => month.contribution);
  const currentMonthContribution = monthlyValues.at(-1) ?? 0;
  const averageContributions = Object.fromEntries(
    AVERAGE_PERIODS.map((period) => [
      period,
      averageMonthlyFromSeries(
        data.monthly,
        period,
        (month) => month.contribution,
      ),
    ]),
  ) as Record<AveragePeriod, number>;
  const averageContribution3Months = averageContributions[3];
  const averageContribution6Months = averageContributions[6];
  const averageContribution9Months = averageContributions[9];
  const averageContribution12Months = averageContributions[12];

  // The contribution recommendation reuses existing income and expense totals.
  // It never creates a second savings or cash-flow balance.
  const monthlySurplusBeforeSavings = Math.max(
    0,
    averageMonthlyIncome - averageMonthlyExpenses,
  );
  const conservativeCapacity = Math.min(
    averageMonthlyIncome * 0.1,
    monthlySurplusBeforeSavings * 0.5,
  );
  const observedSustainablePace = Math.min(
    averageContribution6Months,
    monthlySurplusBeforeSavings,
  );
  const sustainablePace = Math.max(
    0,
    conservativeCapacity,
    observedSustainablePace,
  );
  const twelveMonthPace = recommendedGap > 0 ? recommendedGap / 12 : 0;
  const suggestedMonthlyContribution =
    recommendedGap > 0 && sustainablePace > 0
      ? Math.min(
          recommendedGap,
          roundToFive(Math.min(twelveMonthPace, sustainablePace)),
        )
      : 0;

  const monthsToRecommendedTarget =
    recommendedGap <= 0
      ? 0
      : suggestedMonthlyContribution > 0
        ? Math.ceil(recommendedGap / suggestedMonthlyContribution)
        : null;
  const estimatedCompletionDate =
    monthsToRecommendedTarget === null
      ? null
      : addMonths(data.generatedAt, monthsToRecommendedTarget);

  const foundationProgress =
    foundationTarget > 0
      ? clamp(currentBalance / foundationTarget, 0, 1)
      : 0;
  const strongProgress =
    strongTarget > 0 ? clamp(currentBalance / strongTarget, 0, 1) : 0;
  const recommendedProgress =
    recommendedTarget > 0
      ? clamp(currentBalance / recommendedTarget, 0, 1)
      : 0;

  const milestones: EmergencyFundMilestone[] = [
    { months: 1, label: "First buffer", target: averageMonthlyExpenses },
    { months: 3, label: "Foundation reserve", target: foundationTarget },
    { months: 6, label: "Strong reserve", target: strongTarget },
  ].map((milestone) => ({
    ...milestone,
    progress:
      milestone.target > 0
        ? clamp(currentBalance / milestone.target, 0, 1)
        : 0,
    remaining: Math.max(0, milestone.target - currentBalance),
    reached: milestone.target > 0 && currentBalance >= milestone.target,
  }));

  const expenseCoverage = averageMonthlyExpenses > 0 ? 35 : 0;
  const historyCoverage = clamp(
    (healthInputs.transactions.activeMonths / 6) * 25,
    0,
    25,
  );
  const incomeCoverage = clamp((incomeMonths / 6) * 20, 0, 20);
  const contributionCoverage = clamp(
    (Math.min(data.stats.contributionCount, 6) / 6) * 20,
    0,
    20,
  );
  const dataCoverage = Math.round(
    expenseCoverage + historyCoverage + incomeCoverage + contributionCoverage,
  );

  const status = statusFor(coverageMonths, averageMonthlyExpenses);

  let summary =
    "Your emergency reserve is calculated from existing Emergency fund saving transactions and your established monthly expense baseline.";
  if (status === "Set baseline") {
    summary =
      "Record regular expenses before FICONTER can calculate a reliable emergency-fund target.";
  } else if (status === "Strong reserve") {
    summary =
      "Your recorded reserve covers at least six average months of expenses, providing strong financial resilience.";
  } else if (status === "Foundation ready") {
    summary =
      "Your three-month foundation is in place. Continue toward the stronger six-month reserve when cash flow allows.";
  } else if (status === "Building") {
    summary =
      "Your reserve covers at least one month of average expenses and is progressing toward the three-month foundation.";
  } else if (status === "Starting") {
    summary =
      "You have started the reserve, but it does not yet cover one full average month of expenses.";
  } else if (status === "Not started") {
    summary =
      "No Emergency fund saving transactions are recorded yet. Start with a sustainable first contribution.";
  }

  let nextBestAction =
    "Maintain the reserve and review the target whenever your regular expenses materially change.";
  if (averageMonthlyExpenses <= 0) {
    nextBestAction =
      "Record your normal monthly expenses so FICONTER can establish a reliable reserve target.";
  } else if (healthInputs.bills.overdueCount > 0) {
    nextBestAction =
      "Resolve overdue bills first, then continue funding the emergency reserve consistently.";
  } else if (health.metrics.netCashFlow < 0) {
    nextBestAction =
      "Stabilize monthly cash flow before committing to a larger emergency-fund contribution.";
  } else if (recommendedGap > 0 && suggestedMonthlyContribution > 0) {
    nextBestAction = `Record approximately €${suggestedMonthlyContribution.toLocaleString(
      "en-US",
      { maximumFractionDigits: 0 },
    )} per month as General Saving with the Emergency fund category.`;
  } else if (recommendedGap > 0) {
    nextBestAction =
      "Create monthly surplus first, then direct part of it to the Emergency fund category.";
  }

  const insights: EmergencyFundInsight[] = [];

  if (coverageMonths >= recommendedTargetMonths) {
    insights.push({
      id: "coverage",
      tone: "positive",
      title: "Recommended reserve reached",
      description: `Your reserve covers ${round(coverageMonths)} months against the current ${recommendedTargetMonths}-month recommendation.`,
    });
  } else if (coverageMonths >= 1) {
    insights.push({
      id: "coverage",
      tone: "info",
      title: "Protection is building",
      description: `You currently cover ${round(coverageMonths)} average months of expenses.`,
    });
  } else {
    insights.push({
      id: "coverage",
      tone: currentBalance > 0 ? "warning" : "critical",
      title: currentBalance > 0 ? "First month still open" : "Reserve not started",
      description:
        currentBalance > 0
          ? "Continue until the reserve covers one complete average month of expenses."
          : "Record the first Emergency fund saving transaction to begin building protection.",
    });
  }

  if (averageContribution6Months > 0) {
    insights.push({
      id: "pace",
      tone: "positive",
      title: "Contribution pace",
      description: `Your average Emergency fund contribution over the last six months is €${round(
        averageContribution6Months,
        0,
      ).toLocaleString("en-US")}.`,
    });
  } else {
    insights.push({
      id: "pace",
      tone: "warning",
      title: "No established contribution pace",
      description:
        "No Emergency fund contribution is recorded in the recent six-month window.",
    });
  }

  insights.push({
    id: "target",
    tone: recommendedTargetMonths === 6 ? "info" : "positive",
    title: `${recommendedTargetMonths}-month recommendation`,
    description:
      recommendedTargetMonths === 6
        ? "Income variability, active debt or overdue obligations support using the stronger six-month target."
        : "Stable income and no active debt or overdue bills support the three-month foundation target.",
  });

  return {
    version: "2.0",
    status,
    summary,
    confidence: confidenceFor(dataCoverage),
    dataCoverage,
    nextBestAction,
    recommendedTargetMonths,
    metrics: {
      currentBalance: round(currentBalance, 2),
      averageMonthlyExpenses: round(averageMonthlyExpenses, 2),
      averageMonthlyIncome: round(averageMonthlyIncome, 2),
      coverageMonths: round(coverageMonths),
      foundationTarget: round(foundationTarget, 2),
      strongTarget: round(strongTarget, 2),
      recommendedTarget: round(recommendedTarget, 2),
      recommendedGap: round(recommendedGap, 2),
      foundationProgress: round(foundationProgress * 100),
      strongProgress: round(strongProgress * 100),
      recommendedProgress: round(recommendedProgress * 100),
      currentMonthContribution: round(currentMonthContribution, 2),
      averageContribution3Months: round(averageContribution3Months, 2),
      averageContribution6Months: round(averageContribution6Months, 2),
      averageContribution9Months: round(averageContribution9Months, 2),
      averageContribution12Months: round(averageContribution12Months, 2),
      averageContributions: {
        3: round(averageContribution3Months, 2),
        6: round(averageContribution6Months, 2),
        9: round(averageContribution9Months, 2),
        12: round(averageContribution12Months, 2),
      },
      suggestedMonthlyContribution: round(suggestedMonthlyContribution, 2),
      monthsToRecommendedTarget,
      estimatedCompletionDate,
      incomeStability: round(incomeStability * 100),
    },
    milestones,
    monthly: data.monthly,
    recentContributions: data.recentContributions,
    insights,
  };
}
