import {
  calculateFinancialHealth,
  normalizeFinancialHealthInputs,
  type FinancialHealthInputs,
  type FinancialHealthResult,
} from "@/lib/wealth/financialHealth";

export type WealthMonthlyPoint = {
  month: string;
  transactionCount: number;
  income: number;
  expenses: number;
  savings: number;
  retainedCapital: number;
  availableCashChange: number;
};

export type WealthLiability = {
  id: string;
  name: string;
  originalBalance: number;
  currentBalance: number;
  annualInterestRate: number;
  status: string;
  updatedAt: string;
};

export type WealthScoreInputs = {
  schemaVersion: number;
  generatedAt: string;
  financialHealth: FinancialHealthInputs;
  wealth: {
    availableCash: number;
    recordedSavings: number;
    recordedCapital: number;
    currentDebt: number;
    netWorth: number;
    recent3MonthIncome: number;
    recent3MonthRetainedCapital: number;
    prior3MonthIncome: number;
    prior3MonthRetainedCapital: number;
    historyMonths: number;
  };
  monthly: WealthMonthlyPoint[];
  liabilities: WealthLiability[];
};

export type WealthScoreFactorId =
  | "net-position"
  | "accumulation"
  | "debt-reduction"
  | "capital-balance"
  | "momentum"
  | "goals"
  | "resilience";

export type WealthScoreFactorStatus =
  | "strong"
  | "balanced"
  | "watch"
  | "priority"
  | "pending";

export type WealthScoreFactor = {
  id: WealthScoreFactorId;
  name: string;
  points: number;
  maximum: number;
  percentage: number;
  status: WealthScoreFactorStatus;
  metricValue: number;
  metricUnit: "percent" | "currency" | "months" | "ratio" | "count" | "none";
  metricLabel?: string;
  assessed: boolean;
  explanation: string;
  action: string;
};

export type WealthScoreLabel =
  | "Exceptional"
  | "Strong"
  | "Progressing"
  | "Building"
  | "Early stage"
  | "Preliminary"
  | "Setup incomplete"
  | "Not assessed";

export type WealthScoreResult = {
  version: "1.0";
  score: number;
  label: WealthScoreLabel;
  summary: string;
  confidence: "High" | "Moderate" | "Developing" | "No data";
  dataCoverage: number;
  assessed: boolean;
  scoreAvailable: boolean;
  preliminary: boolean;
  missingInputs: string[];
  nextBestAction: string;
  health: FinancialHealthResult;
  metrics: {
    availableCash: number;
    recordedSavings: number;
    recordedCapital: number;
    currentDebt: number;
    netWorth: number;
    netWorthMonths: number;
    capitalToDebtRatio: number;
    capitalToDebtRatioAvailable: boolean;
    accumulationRate: number;
    debtProgress: number;
    recentRetentionRate: number;
    recentRetentionAvailable: boolean;
    priorRetentionRate: number;
    momentumChange: number;
    momentumAvailable: boolean;
    goalProgress: number;
    emergencyCoverageMonths: number;
    activeDebtAccounts: number;
  };
  factors: WealthScoreFactor[];
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

function statusFor(points: number, maximum: number): WealthScoreFactorStatus {
  const ratio = maximum > 0 ? points / maximum : 0;
  if (ratio >= 0.8) return "strong";
  if (ratio >= 0.55) return "balanced";
  if (ratio >= 0.3) return "watch";
  return "priority";
}

function factor(
  value: Omit<WealthScoreFactor, "points" | "percentage" | "status"> & {
    points: number;
  },
): WealthScoreFactor {
  const points = value.assessed
    ? round(clamp(value.points, 0, value.maximum))
    : 0;
  const percentage =
    value.assessed && value.maximum > 0
      ? round((points / value.maximum) * 100)
      : 0;

  return {
    ...value,
    points,
    percentage,
    status: value.assessed ? statusFor(points, value.maximum) : "pending",
  };
}

function scoreLabel(score: number): WealthScoreLabel {
  if (score >= 90) return "Exceptional";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Progressing";
  if (score >= 40) return "Building";
  return "Early stage";
}

function confidenceFor(coverage: number): WealthScoreResult["confidence"] {
  if (coverage <= 0) return "No data";
  if (coverage >= 75) return "High";
  if (coverage >= 45) return "Moderate";
  return "Developing";
}

export function normalizeWealthScoreInputs(value: unknown): WealthScoreInputs {
  const root = object(value);
  const financialHealth = normalizeFinancialHealthInputs(root.financialHealth);
  const health = calculateFinancialHealth(financialHealth);
  const wealth = object(root.wealth);

  const availableCash = finite(
    wealth.availableCash,
    health.metrics.netCashFlow,
  );
  const recordedSavings = finite(
    wealth.recordedSavings,
    health.metrics.totalSavings,
  );
  const recordedCapital = finite(
    wealth.recordedCapital,
    availableCash + recordedSavings,
  );
  const currentDebt = finite(wealth.currentDebt, health.metrics.currentDebt);

  return {
    schemaVersion: integer(root.schemaVersion) || 1,
    generatedAt:
      typeof root.generatedAt === "string"
        ? root.generatedAt
        : new Date().toISOString(),
    financialHealth,
    wealth: {
      availableCash,
      recordedSavings,
      recordedCapital,
      currentDebt,
      netWorth: finite(wealth.netWorth, recordedCapital - currentDebt),
      recent3MonthIncome: finite(wealth.recent3MonthIncome),
      recent3MonthRetainedCapital: finite(
        wealth.recent3MonthRetainedCapital,
      ),
      prior3MonthIncome: finite(wealth.prior3MonthIncome),
      prior3MonthRetainedCapital: finite(wealth.prior3MonthRetainedCapital),
      historyMonths: integer(
        wealth.historyMonths ?? financialHealth.transactions.activeMonths,
      ),
    },
    monthly: array(root.monthly).map((entry) => {
      const point = object(entry);
      return {
        month: typeof point.month === "string" ? point.month : "",
        transactionCount: integer(point.transactionCount),
        income: finite(point.income),
        expenses: finite(point.expenses),
        savings: finite(point.savings),
        retainedCapital: finite(point.retainedCapital),
        availableCashChange: finite(point.availableCashChange),
      };
    }),
    liabilities: array(root.liabilities)
      .map((entry) => {
        const liability = object(entry);
        return {
          id: typeof liability.id === "string" ? liability.id : "",
          name: typeof liability.name === "string" ? liability.name : "Debt",
          originalBalance: finite(liability.originalBalance),
          currentBalance: finite(liability.currentBalance),
          annualInterestRate: finite(liability.annualInterestRate),
          status: typeof liability.status === "string" ? liability.status : "active",
          updatedAt:
            typeof liability.updatedAt === "string" ? liability.updatedAt : "",
        };
      })
      .filter((liability) => liability.id),
  };
}

export function calculateWealthScore(value: WealthScoreInputs): WealthScoreResult {
  const data = normalizeWealthScoreInputs(value);
  const health = calculateFinancialHealth(data.financialHealth);
  const metrics = health.metrics;
  const wealth = data.wealth;
  const averageMonthlyIncome = metrics.averageMonthlyIncome;
  const hasAnyData =
    data.financialHealth.transactions.count > 0 ||
    data.financialHealth.bills.count > 0 ||
    data.financialHealth.debts.count > 0 ||
    data.financialHealth.goals.count > 0 ||
    data.financialHealth.planner.itemCount > 0 ||
    data.liabilities.length > 0 ||
    Math.abs(wealth.recordedCapital) > 0.005 ||
    Math.abs(wealth.currentDebt) > 0.005;
  const hasDebtData =
    data.financialHealth.debts.count > 0 ||
    data.liabilities.length > 0 ||
    Math.abs(wealth.currentDebt) > 0.005;
  const hasCapitalData =
    data.financialHealth.transactions.count > 0 ||
    Math.abs(wealth.recordedCapital) > 0.005;
  const cashFlowFactor = health.factors.find((factor) => factor.id === "cash-flow");
  const emergencyFactor = health.factors.find(
    (factor) => factor.id === "emergency-fund",
  );
  const hasCashFlowBaseline = cashFlowFactor?.assessed === true;

  const netWorthMonths =
    averageMonthlyIncome > 0 ? wealth.netWorth / averageMonthlyIncome : 0;
  const capitalToDebtRatioAvailable = hasDebtData && wealth.currentDebt > 0;
  const capitalToDebtRatio = capitalToDebtRatioAvailable
    ? Math.max(wealth.recordedCapital, 0) / wealth.currentDebt
    : 0;
  const accumulationRate = metrics.savingsRate;

  const recentRetentionAvailable =
    wealth.historyMonths >= 3 && wealth.recent3MonthIncome > 0;
  const recentRetentionRate = recentRetentionAvailable
    ? wealth.recent3MonthRetainedCapital / wealth.recent3MonthIncome
    : 0;
  const priorRetentionRate =
    wealth.prior3MonthIncome > 0
      ? wealth.prior3MonthRetainedCapital / wealth.prior3MonthIncome
      : 0;
  const momentumAvailable =
    wealth.historyMonths >= 6 &&
    wealth.recent3MonthIncome > 0 &&
    wealth.prior3MonthIncome > 0;
  const momentumChange = momentumAvailable
    ? recentRetentionRate - priorRetentionRate
    : 0;

  const netPositionPoints = hasCashFlowBaseline
    ? clamp(((netWorthMonths + 12) / 24) * 25, 0, 25)
    : 0;
  const accumulationPoints = hasCashFlowBaseline
    ? clamp((accumulationRate / 0.25) * 20, 0, 20)
    : 0;
  const debtReductionPoints = !hasDebtData
    ? 0
    : data.financialHealth.debts.activeCount === 0 && wealth.currentDebt <= 0
      ? 15
      : metrics.debtProgress * 15;
  const capitalBalancePoints = !hasDebtData
    ? 0
    : wealth.currentDebt <= 0
      ? 15
      : clamp((capitalToDebtRatio / 1.25) * 15, 0, 15);

  let momentumPoints = 0;
  let momentumMetricLabel = recentRetentionAvailable
    ? `${round(recentRetentionRate * 100)}% recent retention`
    : "Awaiting 3 months";
  let momentumExplanation = recentRetentionAvailable
    ? "A recent three-month retention rate is available, but six months are required before FICONTER scores the trend."
    : "FICONTER needs three active months before displaying recent retention and six months before comparing momentum.";
  let momentumAction =
    "Keep recording income, expenses and savings so your trajectory becomes measurable.";

  if (momentumAvailable) {
    const levelPoints = clamp(((recentRetentionRate + 0.1) / 0.35) * 7, 0, 7);
    const trendPoints = clamp(((momentumChange + 0.1) / 0.2) * 3, 0, 3);
    momentumPoints = levelPoints + trendPoints;
    momentumMetricLabel = `${round(recentRetentionRate * 100)}% recent retention`;
    momentumExplanation =
      "Compares retained capital from the latest three months with the preceding three months.";
    momentumAction =
      recentRetentionRate <= 0
        ? "Restore positive retained capital before increasing long-term commitments."
        : momentumChange < 0
          ? "Protect your retained-capital rate and reverse the recent slowdown."
          : "Keep recent wealth accumulation positive and consistent.";
  }

  const goalPoints =
    data.financialHealth.goals.count > 0
      ? metrics.goalProgress * 10
      : 0;
  const resiliencePoints = clamp(
    (metrics.emergencyFundCoverageMonths / 6) * 5,
    0,
    5,
  );

  const factors: WealthScoreFactor[] = [
    factor({
      id: "net-position",
      name: "Net wealth position",
      assessed: hasCashFlowBaseline,
      points: netPositionPoints,
      maximum: 25,
      metricValue: wealth.netWorth,
      metricUnit: "currency",
      metricLabel: hasCashFlowBaseline
        ? `${round(netWorthMonths, 1)} months of income`
        : "Cash-flow baseline required",
      explanation: hasCashFlowBaseline
        ? "Measures recorded capital after subtracting every active liability, relative to average monthly income."
        : "Income alone is not enough to assess the recorded net position reliably.",
      action: !hasCashFlowBaseline
        ? "Record capital, liabilities or financial activity to activate net-position scoring."
        : wealth.netWorth < 0
          ? "Move net wealth toward zero by retaining capital and reducing principal consistently."
          : netWorthMonths < 6
            ? "Build recorded net wealth toward at least six months of average income."
            : "Protect positive net wealth and keep expanding productive capital.",
    }),
    factor({
      id: "accumulation",
      name: "Wealth accumulation",
      assessed: hasCashFlowBaseline,
      points: accumulationPoints,
      maximum: 20,
      metricValue: accumulationRate * 100,
      metricUnit: "percent",
      explanation: !hasCashFlowBaseline
        ? "Income and outflow records are required before accumulation can be assessed."
        : "Reuses the same recorded savings rate shown on Overview; no second savings calculation is maintained.",
      action: !hasCashFlowBaseline
        ? "Record income and savings to activate wealth-accumulation scoring."
        : accumulationRate >= 0.25
          ? "Maintain this accumulation rate and direct it toward clearly defined wealth priorities."
          : "Work toward retaining at least 25% of income for savings and long-term priorities when feasible.",
    }),
    factor({
      id: "debt-reduction",
      name: "Debt reduction",
      assessed: hasDebtData,
      points: debtReductionPoints,
      maximum: 15,
      metricValue: metrics.debtProgress * 100,
      metricUnit: "percent",
      metricLabel: !hasDebtData
        ? "No liabilities recorded"
        : data.financialHealth.debts.activeCount === 0 && wealth.currentDebt <= 0
          ? "Debt-free"
          : `${round(metrics.debtProgress * 100)}% repaid`,
      explanation: !hasDebtData
        ? "No liability records are available for debt-reduction assessment."
        : data.financialHealth.debts.activeCount === 0 && wealth.currentDebt <= 0
          ? "Recorded liability accounts confirm no active outstanding balance."
          : "Uses the existing original and current debt balances to measure principal reduction.",
      action: !hasDebtData
        ? "Add liabilities, or complete a no-debt confirmation flow when available."
        : data.financialHealth.debts.activeCount === 0 && wealth.currentDebt <= 0
          ? "Keep future borrowing purposeful and affordable."
          : metrics.debtProgress < 0.25
            ? "Accelerate principal reduction on the most expensive or restrictive balances."
            : "Continue reducing principal without weakening your emergency reserve.",
    }),
    factor({
      id: "capital-balance",
      name: "Capital-to-debt balance",
      assessed: hasDebtData && hasCapitalData,
      points: capitalBalancePoints,
      maximum: 15,
      metricValue: capitalToDebtRatio,
      metricUnit: "ratio",
      metricLabel: !hasDebtData
        ? "No liabilities recorded"
        : wealth.currentDebt <= 0
          ? "Debt-free"
          : `${round(capitalToDebtRatio, 2)}× recorded capital`,
      explanation: !hasDebtData
        ? "A capital-to-debt ratio is not calculated until liability information is recorded."
        : "Compares retained recorded capital with active liabilities without creating a separate asset balance.",
      action: !hasDebtData
        ? "Record any liabilities before relying on the capital-to-debt balance."
        : wealth.currentDebt <= 0
          ? "Preserve your debt-free position while growing productive capital."
          : capitalToDebtRatio < 0.5
            ? "Increase retained capital and reduce liabilities to strengthen your balance sheet."
            : "Keep moving recorded capital closer to, and eventually above, total debt.",
    }),
    factor({
      id: "momentum",
      name: "Wealth momentum",
      assessed: momentumAvailable,
      points: momentumPoints,
      maximum: 10,
      metricValue: momentumChange * 100,
      metricUnit: "percent",
      metricLabel: momentumMetricLabel,
      explanation: momentumExplanation,
      action: momentumAction,
    }),
    factor({
      id: "goals",
      name: "Long-term goal funding",
      assessed: data.financialHealth.goals.count > 0,
      points: goalPoints,
      maximum: 10,
      metricValue: metrics.goalProgress * 100,
      metricUnit: "percent",
      metricLabel:
        data.financialHealth.goals.count > 0
          ? `${round(metrics.goalProgress * 100)}% funded`
          : "No goals tracked",
      explanation:
        data.financialHealth.goals.count > 0
          ? "Reuses the existing Goals progress that is already synchronized with saving transactions."
          : "No measurable long-term target is currently available for wealth planning.",
      action:
        data.financialHealth.goals.count > 0
          ? "Keep goal funding aligned with target dates and available cash flow."
          : "Create a measurable long-term goal to give wealth accumulation a clear destination.",
    }),
    factor({
      id: "resilience",
      name: "Wealth resilience",
      assessed: emergencyFactor?.assessed === true,
      points: resiliencePoints,
      maximum: 5,
      metricValue: metrics.emergencyFundCoverageMonths,
      metricUnit: "months",
      explanation: emergencyFactor?.assessed !== true
        ? "No expense baseline or emergency reserve is available for resilience assessment."
        : "Reuses the Financial Health emergency-reserve coverage so the same reserve is never counted twice.",
      action: emergencyFactor?.assessed !== true
        ? "Record regular expenses and emergency savings to activate resilience scoring."
        : metrics.emergencyFundCoverageMonths >= 6
          ? "Maintain a six-month reserve while directing additional capital toward growth."
          : "Strengthen the emergency reserve toward six months before taking more investment risk.",
    }),
  ];

  const assessedFactors = factors.filter((current) => current.assessed);
  const assessedMaximum = assessedFactors.reduce(
    (total, current) => total + current.maximum,
    0,
  );
  const scoreAvailable =
    hasCashFlowBaseline &&
    assessedFactors.some((factor) => factor.id === "net-position") &&
    assessedFactors.some((factor) => factor.id === "accumulation");
  const score = scoreAvailable
    ? Math.round(
        clamp(
          (assessedFactors.reduce(
            (total, current) => total + current.points,
            0,
          ) /
            assessedMaximum) *
            100,
          0,
          100,
        ),
      )
    : 0;

  const factorCoverage = (assessedMaximum / 100) * 70;
  const historyCoverage = clamp(wealth.historyMonths / 6, 0, 1) * 15;
  const transactionCoverage =
    clamp(data.financialHealth.transactions.count / 12, 0, 1) * 15;
  const dataCoverage = hasAnyData
    ? Math.round(
        clamp(
          factorCoverage + historyCoverage + transactionCoverage,
          0,
          100,
        ),
      )
    : 0;
  const confidence = confidenceFor(dataCoverage);
  const preliminary = scoreAvailable && dataCoverage < 55;
  const label: WealthScoreLabel = !hasAnyData
    ? "Not assessed"
    : !scoreAvailable
      ? "Setup incomplete"
      : preliminary
        ? "Preliminary"
        : scoreLabel(score);

  const ordered = [...assessedFactors].sort(
    (a, b) => a.points / a.maximum - b.points / b.maximum,
  );
  const weakest = ordered[0] ?? factors[0];
  const strongest = ordered.at(-1) ?? weakest;
  const missingInputs = [
    !hasCashFlowBaseline ? "income and outflow history" : "",
    !hasDebtData ? "liability information" : "",
    data.financialHealth.goals.count === 0 ? "a long-term goal" : "",
    emergencyFactor?.assessed !== true ? "an emergency-fund baseline" : "",
    !recentRetentionAvailable ? "three months of history" : "",
    !momentumAvailable ? "six months of comparable history" : "",
  ].filter(Boolean);

  const summary = !hasAnyData
    ? "No wealth records are available yet. Add financial activity or liabilities to begin a long-term wealth assessment."
    : !scoreAvailable
      ? "Your wealth profile is incomplete. Add both income and outflow information before FICONTER calculates a Wealth Score."
      : preliminary
        ? `Preliminary assessment based on ${assessedFactors.length} of 7 wealth factors. More history and balance-sheet detail will improve reliability.`
        : `${label}. ${strongest.name} currently supports your trajectory, while ${weakest.name.toLowerCase()} is the clearest opportunity to strengthen long-term wealth.`;

  const setupAction = !hasCashFlowBaseline
    ? "Record both income and at least one expense or saving outflow before FICONTER calculates a Wealth Score."
    : "Complete more wealth sections before relying on the score.";

  return {
    version: "1.0",
    score,
    label,
    summary,
    confidence,
    dataCoverage,
    assessed: scoreAvailable && !preliminary,
    scoreAvailable,
    preliminary,
    missingInputs,
    nextBestAction: !scoreAvailable
      ? setupAction
      : preliminary && missingInputs.length > 0
        ? `Add ${missingInputs[0]} to make this preliminary score more reliable.`
        : weakest.action,
    health,
    metrics: {
      availableCash: wealth.availableCash,
      recordedSavings: wealth.recordedSavings,
      recordedCapital: wealth.recordedCapital,
      currentDebt: wealth.currentDebt,
      netWorth: wealth.netWorth,
      netWorthMonths,
      capitalToDebtRatio,
      capitalToDebtRatioAvailable,
      accumulationRate,
      debtProgress: metrics.debtProgress,
      recentRetentionRate,
      recentRetentionAvailable,
      priorRetentionRate,
      momentumChange,
      momentumAvailable,
      goalProgress: metrics.goalProgress,
      emergencyCoverageMonths: metrics.emergencyFundCoverageMonths,
      activeDebtAccounts: data.financialHealth.debts.activeCount,
    },
    factors,
  };
}
