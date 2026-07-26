import {
  calculateEmergencyFund,
  normalizeEmergencyFundInputs,
  type EmergencyFundInputs,
  type EmergencyFundResult,
} from "@/lib/wealth/emergencyFund";
import {
  calculateNetWorthGrowth,
  normalizeNetWorthGrowthInputs,
  type NetWorthGrowthInputs,
  type NetWorthGrowthResult,
} from "@/lib/wealth/netWorthGrowth";
import {
  calculateSavingsIntelligence,
  normalizeSavingsIntelligenceInputs,
  type SavingsIntelligenceInputs,
  type SavingsIntelligenceResult,
} from "@/lib/wealth/savingsIntelligence";

export type FinancialIndependenceSettings = {
  targetMonthlySpending: number | null;
  withdrawalRate: number;
  annualRealReturnRate: number;
  updatedAt: string | null;
};

export type FinancialIndependenceInputs = {
  schemaVersion: number;
  generatedAt: string;
  netWorthGrowth: NetWorthGrowthInputs;
  savingsIntelligence: SavingsIntelligenceInputs;
  emergencyFund: EmergencyFundInputs;
  settings: FinancialIndependenceSettings;
};

export type FinancialIndependenceStage =
  | "Not assessed"
  | "Starting"
  | "Debt-clearing"
  | "Foundation"
  | "Building"
  | "Advancing"
  | "Approaching"
  | "Independent";

export type FinancialIndependenceConfidence =
  | "High"
  | "Moderate"
  | "Developing"
  | "No data";

export type FinancialIndependenceInsightTone =
  | "positive"
  | "info"
  | "warning"
  | "critical";

export type FinancialIndependenceInsight = {
  id: string;
  tone: FinancialIndependenceInsightTone;
  title: string;
  description: string;
  action: string;
};

export type FinancialIndependenceMilestone = {
  percentage: number;
  label: string;
  amount: number;
  reached: boolean;
};

export type FinancialIndependenceScenario = {
  id: "current" | "plus-100" | "plus-250";
  label: string;
  monthlyContribution: number;
  monthsToTarget: number | null;
  estimatedDate: string | null;
  yearsSaved: number | null;
};

export type FinancialIndependenceReadinessItem = {
  id: string;
  label: string;
  complete: boolean;
  detail: string;
};

export type FinancialIndependenceResult = {
  version: "1.0";
  stage: FinancialIndependenceStage;
  summary: string;
  confidence: FinancialIndependenceConfidence;
  dataCoverage: number;
  assessed: boolean;
  nextBestAction: string;
  assumptions: {
    targetMonthlySpending: number;
    withdrawalRate: number;
    annualRealReturnRate: number;
    usesCurrentExpenseBaseline: boolean;
  };
  metrics: {
    annualTargetSpending: number;
    financialIndependenceTarget: number;
    currentNetWorth: number;
    protectedEmergencyReserve: number;
    investableCapital: number;
    foundationGap: number;
    progress: number;
    monthlyFreedomIncome: number;
    monthlySavingsPace: number;
    monthlyDebtReductionPace: number;
    monthlyWealthContribution: number;
    monthsToTarget: number | null;
    estimatedIndependenceDate: string | null;
    completedHistoryMonths: number;
    readinessScore: number;
  };
  milestones: FinancialIndependenceMilestone[];
  scenarios: FinancialIndependenceScenario[];
  readiness: FinancialIndependenceReadinessItem[];
  insights: FinancialIndependenceInsight[];
  sources: {
    growth: NetWorthGrowthResult;
    savings: SavingsIntelligenceResult;
    emergency: EmergencyFundResult;
  };
};

const EMPTY_INPUTS: FinancialIndependenceInputs = {
  schemaVersion: 1,
  generatedAt: new Date(0).toISOString(),
  netWorthGrowth: normalizeNetWorthGrowthInputs(null),
  savingsIntelligence: normalizeSavingsIntelligenceInputs(null),
  emergencyFund: normalizeEmergencyFundInputs(null),
  settings: {
    targetMonthlySpending: null,
    withdrawalRate: 4,
    annualRealReturnRate: 4,
    updatedAt: null,
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundedCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function nullableDate(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function confidenceFor(coverage: number): FinancialIndependenceConfidence {
  if (coverage <= 0) return "No data";
  if (coverage >= 75) return "High";
  if (coverage >= 45) return "Moderate";
  return "Developing";
}

function stageFor(
  currentNetWorth: number,
  progress: number,
  target: number,
): FinancialIndependenceStage {
  if (target > 0 && progress >= 1) return "Independent";
  if (currentNetWorth < 0) return "Debt-clearing";
  if (progress >= 0.75) return "Approaching";
  if (progress >= 0.5) return "Advancing";
  if (progress >= 0.25) return "Building";
  if (progress > 0) return "Foundation";
  return "Starting";
}

function addMonthsToNow(months: number): string | null {
  if (!Number.isFinite(months) || months < 0 || months > 1200) return null;
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + Math.ceil(months));
  return date.toISOString();
}

function monthsToFutureValue(
  startingCapital: number,
  monthlyContribution: number,
  annualRealReturnRate: number,
  target: number,
): number | null {
  if (target <= 0 || startingCapital >= target) return 0;
  if (monthlyContribution <= 0 && annualRealReturnRate <= 0) return null;

  const principal = Math.max(0, startingCapital);
  const contribution = Math.max(0, monthlyContribution);
  const annualRate = annualRealReturnRate / 100;
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;

  let months: number;
  if (Math.abs(monthlyRate) < 1e-9) {
    if (contribution <= 0) return null;
    months = (target - principal) / contribution;
  } else {
    const offset = contribution / monthlyRate;
    const denominator = principal + offset;
    const numerator = target + offset;
    if (denominator <= 0 || numerator <= 0) return null;
    months = Math.log(numerator / denominator) / Math.log(1 + monthlyRate);
  }

  if (!Number.isFinite(months) || months < 0 || months > 1200) return null;
  return Math.ceil(months);
}

function completeMonths<T extends { month: string }>(months: readonly T[]): T[] {
  const currentMonth = new Date().toISOString().slice(0, 7);
  return months.filter((month) => month.month && month.month < currentMonth);
}

function debtReductionPace(growth: NetWorthGrowthResult): number {
  const completed = completeMonths(growth.fullMonthly).slice(-6);
  if (!completed.length) return 0;
  const reduction = completed.reduce(
    (total, month) => total + Math.max(0, -month.debtChange),
    0,
  );
  return reduction / 6;
}

function scenario(
  id: FinancialIndependenceScenario["id"],
  label: string,
  startingCapital: number,
  foundationGap: number,
  monthlyContribution: number,
  annualRealReturnRate: number,
  target: number,
  baselineMonths: number | null,
): FinancialIndependenceScenario {
  const foundationMonths =
    foundationGap > 0 && monthlyContribution > 0
      ? Math.ceil(foundationGap / monthlyContribution)
      : foundationGap > 0
        ? null
        : 0;
  const accumulationMonths = monthsToFutureValue(
    startingCapital,
    monthlyContribution,
    annualRealReturnRate,
    target,
  );
  const totalMonths =
    foundationMonths === null || accumulationMonths === null
      ? null
      : foundationMonths + accumulationMonths;

  return {
    id,
    label,
    monthlyContribution: roundedCurrency(monthlyContribution),
    monthsToTarget: totalMonths,
    estimatedDate: totalMonths === null ? null : addMonthsToNow(totalMonths),
    yearsSaved:
      baselineMonths !== null && totalMonths !== null
        ? round(Math.max(0, baselineMonths - totalMonths) / 12, 1)
        : null,
  };
}

export function normalizeFinancialIndependenceInputs(
  value: unknown,
): FinancialIndependenceInputs {
  const root = object(value);
  const settings = object(root.settings);
  const targetMonthlySpending = finite(settings.targetMonthlySpending, NaN);

  return {
    schemaVersion: integer(root.schemaVersion) || 1,
    generatedAt:
      typeof root.generatedAt === "string"
        ? root.generatedAt
        : new Date().toISOString(),
    netWorthGrowth: normalizeNetWorthGrowthInputs(root.netWorthGrowth),
    savingsIntelligence: normalizeSavingsIntelligenceInputs(
      root.savingsIntelligence,
    ),
    emergencyFund: normalizeEmergencyFundInputs(root.emergencyFund),
    settings: {
      targetMonthlySpending:
        Number.isFinite(targetMonthlySpending) && targetMonthlySpending >= 0
          ? targetMonthlySpending
          : null,
      withdrawalRate: clamp(finite(settings.withdrawalRate, 4), 2, 8),
      annualRealReturnRate: clamp(
        finite(settings.annualRealReturnRate, 4),
        -2,
        12,
      ),
      updatedAt: nullableDate(settings.updatedAt),
    },
  };
}

export function calculateFinancialIndependence(
  input: FinancialIndependenceInputs = EMPTY_INPUTS,
): FinancialIndependenceResult {
  const data = normalizeFinancialIndependenceInputs(input);
  const growth = calculateNetWorthGrowth(data.netWorthGrowth, "all");
  const savings = calculateSavingsIntelligence(data.savingsIntelligence);
  const emergency = calculateEmergencyFund(data.emergencyFund);
  const health = savings.cashFlow.health;
  const assessed =
    health.assessed ||
    growth.dataCoverage > 0 ||
    savings.hasSavingsData ||
    emergency.dataCoverage > 0;

  const currentExpenseBaseline = Math.max(
    0,
    health.metrics.averageMonthlyExpenses,
  );
  const targetMonthlySpending = Math.max(
    0,
    data.settings.targetMonthlySpending ?? currentExpenseBaseline,
  );
  const withdrawalRate = clamp(data.settings.withdrawalRate, 2, 8);
  const annualRealReturnRate = clamp(
    data.settings.annualRealReturnRate,
    -2,
    12,
  );
  const annualTargetSpending = targetMonthlySpending * 12;
  const financialIndependenceTarget =
    withdrawalRate > 0 ? annualTargetSpending / (withdrawalRate / 100) : 0;

  const currentNetWorth = growth.metrics.currentNetWorth;
  const protectedEmergencyReserve = Math.max(
    0,
    Math.min(
      emergency.metrics.currentBalance,
      emergency.metrics.recommendedTarget,
    ),
  );
  const adjustedNetWorth = currentNetWorth - protectedEmergencyReserve;
  const investableCapital = Math.max(0, adjustedNetWorth);
  const foundationGap = Math.max(0, -adjustedNetWorth);
  const progress =
    financialIndependenceTarget > 0
      ? clamp(investableCapital / financialIndependenceTarget, 0, 1)
      : 0;
  const monthlyFreedomIncome =
    investableCapital * (withdrawalRate / 100) / 12;

  const monthlySavingsPace = Math.max(
    0,
    savings.metrics.averageMonthlySavings6Months,
  );
  const monthlyDebtReductionPace = Math.max(0, debtReductionPace(growth));
  const monthlyWealthContribution =
    monthlySavingsPace + monthlyDebtReductionPace;

  const foundationMonths =
    foundationGap > 0 && monthlyWealthContribution > 0
      ? Math.ceil(foundationGap / monthlyWealthContribution)
      : foundationGap > 0
        ? null
        : 0;
  const accumulationMonths = monthsToFutureValue(
    investableCapital,
    monthlyWealthContribution,
    annualRealReturnRate,
    financialIndependenceTarget,
  );
  const monthsToTarget =
    foundationMonths === null || accumulationMonths === null
      ? null
      : foundationMonths + accumulationMonths;
  const estimatedIndependenceDate =
    monthsToTarget === null ? null : addMonthsToNow(monthsToTarget);

  const stage = assessed
    ? stageFor(
        currentNetWorth,
        progress,
        financialIndependenceTarget,
      )
    : "Not assessed";

  const hasNetWorthData =
    data.netWorthGrowth.wealthScore.financialHealth.transactions.count > 0 ||
    data.netWorthGrowth.wealthScore.financialHealth.debts.count > 0 ||
    data.netWorthGrowth.wealthScore.liabilities.length > 0;
  const hasBillData =
    data.savingsIntelligence.cashFlow.financialHealth.bills.count > 0;
  const readiness: FinancialIndependenceReadinessItem[] = [
    {
      id: "positive-net-worth",
      label: "Positive net wealth",
      complete: hasNetWorthData && currentNetWorth >= 0,
      detail: !hasNetWorthData
        ? "No capital or liability records are available yet."
        : currentNetWorth >= 0
          ? "Recorded capital exceeds outstanding liabilities."
          : "Outstanding liabilities still exceed recorded capital.",
    },
    {
      id: "emergency-reserve",
      label: "Three-month reserve",
      complete:
        emergency.dataCoverage > 0 && emergency.metrics.coverageMonths >= 3,
      detail:
        emergency.dataCoverage > 0
          ? `${round(emergency.metrics.coverageMonths, 1)} months of average expenses are currently protected.`
          : "No expense baseline and emergency-reserve history are available yet.",
    },
    {
      id: "positive-flow",
      label: "Positive cash-flow margin",
      complete:
        health.metrics.totalIncome > 0 && health.metrics.cashFlowMargin > 0,
      detail:
        health.metrics.totalIncome > 0
          ? `${round(health.metrics.cashFlowMargin * 100, 1)}% current cash-flow margin.`
          : "No recorded income is available for cash-flow assessment.",
    },
    {
      id: "consistent-saving",
      label: "Consistent wealth contribution",
      complete:
        savings.hasSavingsData &&
        savings.metrics.consistencyRate >= 0.5 &&
        monthlyWealthContribution > 0,
      detail: savings.hasSavingsData
        ? `${round(savings.metrics.consistencyRate * 100)}% saving consistency with ${roundedCurrency(monthlyWealthContribution)} EUR average monthly wealth-building pace.`
        : "No non-emergency saving history is available yet.",
    },
    {
      id: "bill-reliability",
      label: "No overdue bills",
      complete: hasBillData && health.metrics.overdueBills === 0,
      detail: !hasBillData
        ? "No bill records are available for reliability assessment."
        : health.metrics.overdueBills === 0
          ? "Recorded bills currently show no overdue obligations."
          : `${health.metrics.overdueBills} overdue bill${health.metrics.overdueBills === 1 ? "" : "s"} require attention.`,
    },
  ];
  const readinessScore = readiness.filter((item) => item.complete).length;

  const baselineScenario = scenario(
    "current",
    "Current pace",
    investableCapital,
    foundationGap,
    monthlyWealthContribution,
    annualRealReturnRate,
    financialIndependenceTarget,
    monthsToTarget,
  );
  const scenarios = [
    baselineScenario,
    scenario(
      "plus-100",
      "+€100 monthly",
      investableCapital,
      foundationGap,
      monthlyWealthContribution + 100,
      annualRealReturnRate,
      financialIndependenceTarget,
      monthsToTarget,
    ),
    scenario(
      "plus-250",
      "+€250 monthly",
      investableCapital,
      foundationGap,
      monthlyWealthContribution + 250,
      annualRealReturnRate,
      financialIndependenceTarget,
      monthsToTarget,
    ),
  ];

  const milestoneDefinitions = [
    [0.1, "First 10%"],
    [0.25, "Quarter funded"],
    [0.5, "Halfway"],
    [0.75, "Three quarters"],
    [1, "Financially independent"],
  ] as const;
  const milestones = milestoneDefinitions.map(([percentage, label]) => ({
    percentage: percentage * 100,
    label,
    amount: financialIndependenceTarget * percentage,
    reached: progress >= percentage,
  }));

  const completedHistoryMonths = completeMonths(growth.fullMonthly).length;
  const dataCoverage = assessed
    ? round(
        clamp(
          growth.dataCoverage * 0.35 +
            savings.dataCoverage * 0.35 +
            emergency.dataCoverage * 0.3,
          0,
          100,
        ),
      )
    : 0;
  const confidence = confidenceFor(dataCoverage);

  let summary =
    "No financial records are available yet. Add activity before FICONTER assesses an independence path.";
  if (assessed) {
    summary =
      "FICONTER is building the financial history needed to estimate a responsible independence path.";
    if (stage === "Debt-clearing") {
      summary =
        "Your independence path is currently in the debt-clearing stage. Each reduction in liabilities improves the starting position for long-term capital growth.";
    } else if (stage === "Independent") {
      summary =
        "Your recorded investable position has reached the selected Financial Independence target under the current planning assumptions.";
    } else if (monthsToTarget !== null) {
      summary =
        "Your current non-emergency saving and debt-reduction pace produces a directional path toward the selected lifestyle target.";
    } else if (monthlyWealthContribution <= 0) {
      summary =
        "A positive, repeatable monthly wealth-building contribution is required before FICONTER can estimate a completion date.";
    }
  }

  let nextBestAction =
    "Record your first income, outflow, saving or liability to activate Financial Independence planning.";
  if (assessed) {
    nextBestAction =
      "Keep recording complete monthly activity so the independence estimate becomes more reliable.";
    if (health.metrics.overdueBills > 0) {
      nextBestAction =
        "Clear overdue obligations first so future contributions can support long-term wealth rather than catch-up payments.";
    } else if (currentNetWorth < 0) {
      nextBestAction =
        "Prioritize principal reduction while preserving essential emergency protection; reaching zero net worth is the first independence milestone.";
    } else if (emergency.metrics.coverageMonths < 3) {
      nextBestAction =
        "Complete the three-month emergency foundation before directing more capital toward long-term independence.";
    } else if (monthlyWealthContribution <= 0) {
      nextBestAction =
        "Create a positive monthly wealth contribution through savings, debt reduction, or both.";
    } else if (savings.metrics.consistencyRate < 0.5) {
      nextBestAction =
        "Make the current contribution pace consistent across more months before increasing the target.";
    } else if (progress < 0.25) {
      nextBestAction =
        "Protect the six-month contribution pace and work toward the first 25% of the selected target.";
    } else {
      nextBestAction =
        "Maintain the current pace and review your lifestyle and return assumptions at least once per year.";
    }
  }

  const insights: FinancialIndependenceInsight[] = !assessed
    ? [
        {
          id: "no-data",
          tone: "info",
          title: "Financial Independence is waiting for records",
          description:
            "Planning assumptions may be configured now, but no financial history is available for a responsible assessment.",
          action:
            "Record income, outflow, savings or liabilities to activate progress and timeline calculations.",
        },
      ]
    : [
    {
      id: "target",
      tone: "info",
      title: "Your target is assumption-driven",
      description: `${roundedCurrency(targetMonthlySpending)} EUR monthly lifestyle spending at a ${withdrawalRate.toFixed(1)}% withdrawal assumption creates a target of ${roundedCurrency(financialIndependenceTarget)} EUR.`,
      action:
        "Adjust the planning assumptions when your long-term lifestyle expectation changes.",
    },
    {
      id: "capital",
      tone: currentNetWorth >= 0 ? "positive" : "warning",
      title:
        currentNetWorth >= 0
          ? "Positive capital is working toward freedom"
          : "Liabilities currently lead the position",
      description: `${roundedCurrency(protectedEmergencyReserve)} EUR is protected as emergency reserve and excluded from investable Financial Independence capital.`,
      action:
        currentNetWorth >= 0
          ? "Preserve the emergency reserve while increasing long-term capital."
          : "Use debt reduction to move the investable starting position above zero.",
    },
    {
      id: "pace",
      tone: monthlyWealthContribution > 0 ? "positive" : "critical",
      title: "Monthly wealth-building pace",
      description: `${roundedCurrency(monthlySavingsPace)} EUR of non-emergency savings plus ${roundedCurrency(monthlyDebtReductionPace)} EUR of average debt reduction produces a ${roundedCurrency(monthlyWealthContribution)} EUR monthly pace.`,
      action:
        monthlyWealthContribution > 0
          ? "Keep the pace repeatable before increasing it."
          : "Restore positive savings or debt reduction before relying on a timeline.",
    },
    {
      id: "timeline",
      tone: monthsToTarget === null ? "warning" : "info",
      title:
        monthsToTarget === null
          ? "Timeline unavailable"
          : "Directional independence date",
      description:
        monthsToTarget === null
          ? "The current data does not support a finite projection under the selected assumptions."
          : `The current pace and selected real-return assumption produce an estimated ${monthsToTarget}-month path. This is a planning estimate, not a guarantee.`,
      action:
        monthsToTarget === null
          ? "Improve the monthly contribution pace and keep complete records."
          : "Use scenario comparisons to understand which contribution changes have the largest effect.",
    },
  ];

  return {
    version: "1.0",
    stage,
    summary,
    confidence,
    dataCoverage,
    assessed,
    nextBestAction,
    assumptions: {
      targetMonthlySpending: roundedCurrency(targetMonthlySpending),
      withdrawalRate: round(withdrawalRate, 2),
      annualRealReturnRate: round(annualRealReturnRate, 2),
      usesCurrentExpenseBaseline:
        data.settings.targetMonthlySpending === null,
    },
    metrics: {
      annualTargetSpending: roundedCurrency(annualTargetSpending),
      financialIndependenceTarget: roundedCurrency(
        financialIndependenceTarget,
      ),
      currentNetWorth: roundedCurrency(currentNetWorth),
      protectedEmergencyReserve: roundedCurrency(protectedEmergencyReserve),
      investableCapital: roundedCurrency(investableCapital),
      foundationGap: roundedCurrency(foundationGap),
      progress: round(progress * 100, 2),
      monthlyFreedomIncome: roundedCurrency(monthlyFreedomIncome),
      monthlySavingsPace: roundedCurrency(monthlySavingsPace),
      monthlyDebtReductionPace: roundedCurrency(monthlyDebtReductionPace),
      monthlyWealthContribution: roundedCurrency(monthlyWealthContribution),
      monthsToTarget,
      estimatedIndependenceDate,
      completedHistoryMonths,
      readinessScore,
    },
    milestones,
    scenarios,
    readiness,
    insights,
    sources: {
      growth,
      savings,
      emergency,
    },
  };
}
