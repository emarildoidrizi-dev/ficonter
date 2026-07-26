import { financialDataReadiness } from "@/lib/wealth/dataReadiness";

export type FinancialHealthInputs = {
  schemaVersion: number;
  generatedAt: string;
  transactions: {
    count: number;
    totalIncome: number;
    totalExpenses: number;
    totalSavings: number;
    emergencyFundSavings: number;
    goalInvestments: number;
    debtPayments: number;
    activeMonths: number;
    incomeMonths: number;
    currentMonthOutflow: number;
  };
  bills: {
    count: number;
    pendingCount: number;
    overdueCount: number;
    paidCount: number;
    paidOnTimeCount: number;
    dueNext30DaysCount: number;
    pendingAmount: number;
  };
  debts: {
    count: number;
    activeCount: number;
    originalBalance: number;
    currentBalance: number;
    minimumMonthlyPayment: number;
    averageInterestRate: number;
  };
  goals: {
    count: number;
    activeCount: number;
    completedCount: number;
    totalTarget: number;
    totalCurrent: number;
  };
  planner: {
    currentMonth: string;
    hasPlan: boolean;
    itemCount: number;
    plannedIncome: number;
    plannedOutflow: number;
  };
};

export type FinancialHealthFactorId =
  | "cash-flow"
  | "savings"
  | "debt"
  | "bills"
  | "emergency-fund"
  | "goals"
  | "planning";

export type FinancialHealthFactorStatus =
  | "strong"
  | "balanced"
  | "watch"
  | "priority";

export type FinancialHealthFactor = {
  id: FinancialHealthFactorId;
  name: string;
  points: number;
  maximum: number;
  percentage: number;
  status: FinancialHealthFactorStatus;
  metricValue: number;
  metricUnit: "percent" | "currency" | "months" | "count" | "none";
  metricLabel?: string;
  explanation: string;
  action: string;
};

export type FinancialHealthLabel =
  | "Excellent"
  | "Healthy"
  | "Stable"
  | "Needs attention"
  | "At risk"
  | "Not assessed";

export type FinancialHealthResult = {
  version: "2.0";
  score: number;
  label: FinancialHealthLabel;
  summary: string;
  confidence: "High" | "Moderate" | "Developing" | "No data";
  dataCoverage: number;
  assessed: boolean;
  nextBestAction: string;
  metrics: {
    totalIncome: number;
    totalExpenses: number;
    totalSavings: number;
    netCashFlow: number;
    cashFlowMargin: number;
    savingsRate: number;
    averageMonthlyIncome: number;
    averageMonthlyExpenses: number;
    emergencyFundCoverageMonths: number;
    currentDebt: number;
    debtProgress: number;
    debtServiceRatio: number;
    goalProgress: number;
    overdueBills: number;
  };
  factors: FinancialHealthFactor[];
};

const EMPTY_INPUTS: FinancialHealthInputs = {
  schemaVersion: 1,
  generatedAt: new Date(0).toISOString(),
  transactions: {
    count: 0,
    totalIncome: 0,
    totalExpenses: 0,
    totalSavings: 0,
    emergencyFundSavings: 0,
    goalInvestments: 0,
    debtPayments: 0,
    activeMonths: 0,
    incomeMonths: 0,
    currentMonthOutflow: 0,
  },
  bills: {
    count: 0,
    pendingCount: 0,
    overdueCount: 0,
    paidCount: 0,
    paidOnTimeCount: 0,
    dueNext30DaysCount: 0,
    pendingAmount: 0,
  },
  debts: {
    count: 0,
    activeCount: 0,
    originalBalance: 0,
    currentBalance: 0,
    minimumMonthlyPayment: 0,
    averageInterestRate: 0,
  },
  goals: {
    count: 0,
    activeCount: 0,
    completedCount: 0,
    totalTarget: 0,
    totalCurrent: 0,
  },
  planner: {
    currentMonth: "",
    hasPlan: false,
    itemCount: 0,
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function statusFor(points: number, maximum: number): FinancialHealthFactorStatus {
  const ratio = maximum > 0 ? points / maximum : 0;
  if (ratio >= 0.8) return "strong";
  if (ratio >= 0.55) return "balanced";
  if (ratio >= 0.3) return "watch";
  return "priority";
}

function factor(
  value: Omit<FinancialHealthFactor, "points" | "percentage" | "status"> & {
    points: number;
  },
): FinancialHealthFactor {
  const points = round(clamp(value.points, 0, value.maximum));
  const percentage = value.maximum > 0 ? round((points / value.maximum) * 100) : 0;

  return {
    ...value,
    points,
    percentage,
    status: statusFor(points, value.maximum),
  };
}

export function normalizeFinancialHealthInputs(value: unknown): FinancialHealthInputs {
  const root = object(value);
  const transactions = object(root.transactions);
  const bills = object(root.bills);
  const debts = object(root.debts);
  const goals = object(root.goals);
  const planner = object(root.planner);

  return {
    schemaVersion: integer(root.schemaVersion) || 1,
    generatedAt:
      typeof root.generatedAt === "string"
        ? root.generatedAt
        : new Date().toISOString(),
    transactions: {
      count: integer(transactions.count),
      totalIncome: finite(transactions.totalIncome),
      totalExpenses: finite(transactions.totalExpenses),
      totalSavings: finite(transactions.totalSavings),
      emergencyFundSavings: finite(transactions.emergencyFundSavings),
      goalInvestments: finite(transactions.goalInvestments),
      debtPayments: finite(transactions.debtPayments),
      activeMonths: integer(transactions.activeMonths),
      incomeMonths: integer(transactions.incomeMonths),
      currentMonthOutflow: finite(transactions.currentMonthOutflow),
    },
    bills: {
      count: integer(bills.count),
      pendingCount: integer(bills.pendingCount),
      overdueCount: integer(bills.overdueCount),
      paidCount: integer(bills.paidCount),
      paidOnTimeCount: integer(bills.paidOnTimeCount),
      dueNext30DaysCount: integer(bills.dueNext30DaysCount),
      pendingAmount: finite(bills.pendingAmount),
    },
    debts: {
      count: integer(debts.count),
      activeCount: integer(debts.activeCount),
      originalBalance: finite(debts.originalBalance),
      currentBalance: finite(debts.currentBalance),
      minimumMonthlyPayment: finite(debts.minimumMonthlyPayment),
      averageInterestRate: finite(debts.averageInterestRate),
    },
    goals: {
      count: integer(goals.count),
      activeCount: integer(goals.activeCount),
      completedCount: integer(goals.completedCount),
      totalTarget: finite(goals.totalTarget),
      totalCurrent: finite(goals.totalCurrent),
    },
    planner: {
      currentMonth:
        typeof planner.currentMonth === "string" ? planner.currentMonth : "",
      hasPlan: planner.hasPlan === true,
      itemCount: integer(planner.itemCount),
      plannedIncome: finite(planner.plannedIncome),
      plannedOutflow: finite(planner.plannedOutflow),
    },
  };
}

function scoreLabel(score: number): FinancialHealthLabel {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 60) return "Stable";
  if (score >= 40) return "Needs attention";
  return "At risk";
}

function confidenceFor(coverage: number): FinancialHealthResult["confidence"] {
  if (coverage <= 0) return "No data";
  if (coverage >= 75) return "High";
  if (coverage >= 45) return "Moderate";
  return "Developing";
}

export function calculateFinancialHealth(
  input: FinancialHealthInputs = EMPTY_INPUTS,
): FinancialHealthResult {
  const data = normalizeFinancialHealthInputs(input);
  const tx = data.transactions;
  const bills = data.bills;
  const debts = data.debts;
  const goals = data.goals;
  const planner = data.planner;
  const readiness = financialDataReadiness(data);
  const {
    hasTransactions,
    hasBills,
    hasDebts,
    hasGoals,
    hasPlannerData,
    hasAnyData: assessed,
  } = readiness;

  const incomeMonths = Math.max(tx.incomeMonths, 1);
  const activeMonths = Math.max(tx.activeMonths, 1);
  const averageMonthlyIncome = tx.totalIncome / incomeMonths;
  const averageMonthlyExpenses = tx.totalExpenses / activeMonths;
  const netCashFlow = tx.totalIncome - tx.totalExpenses - tx.totalSavings;
  const cashFlowMargin = tx.totalIncome > 0 ? netCashFlow / tx.totalIncome : 0;
  const savingsRate = tx.totalIncome > 0 ? tx.totalSavings / tx.totalIncome : 0;
  const debtProgress =
    debts.originalBalance > 0
      ? clamp((debts.originalBalance - debts.currentBalance) / debts.originalBalance, 0, 1)
      : hasDebts && debts.activeCount === 0
        ? 1
        : 0;
  const debtServiceRatio =
    averageMonthlyIncome > 0
      ? debts.minimumMonthlyPayment / averageMonthlyIncome
      : debts.minimumMonthlyPayment > 0
        ? 1
        : 0;
  const emergencyFundCoverageMonths =
    averageMonthlyExpenses > 0
      ? tx.emergencyFundSavings / averageMonthlyExpenses
      : tx.emergencyFundSavings > 0
        ? 3
        : 0;
  const goalProgress =
    goals.totalTarget > 0
      ? clamp(goals.totalCurrent / goals.totalTarget, 0, 1)
      : 0;

  const cashFlowPoints =
    tx.totalIncome > 0
      ? clamp(((cashFlowMargin + 0.15) / 0.4) * 25, 0, 25)
      : 0;
  const savingsPoints =
    tx.totalIncome > 0 ? clamp((savingsRate / 0.2) * 20, 0, 20) : 0;

  let debtPoints = 0;
  let debtExplanation = "No debt records are available for assessment.";
  let debtAction = "Add any active liabilities so FICONTER can assess debt pressure accurately.";
  let debtMetricLabel = "No debt records";

  if (hasDebts && debts.activeCount === 0) {
    debtPoints = 20;
    debtExplanation = "Recorded debt accounts show no active outstanding balance.";
    debtAction = "Keep future borrowing deliberate and affordable.";
    debtMetricLabel = "No active debt";
  } else if (debts.activeCount > 0) {
    const servicePoints = clamp(((0.5 - debtServiceRatio) / 0.4) * 10, 0, 10);
    const progressPoints = debtProgress * 6;
    const interestRate = debts.averageInterestRate / 100;
    const interestPoints = clamp(((0.25 - interestRate) / 0.2) * 4, 0, 4);
    debtPoints = servicePoints + progressPoints + interestPoints;
    debtExplanation = `${debts.activeCount} active debt account${debts.activeCount === 1 ? "" : "s"} currently use part of your monthly capacity.`;
    debtAction =
      debtServiceRatio > 0.35
        ? "Reduce required monthly debt payments or refinance expensive balances where appropriate."
        : debtProgress < 0.25
          ? "Prioritize consistent principal reduction to improve your debt position."
          : "Continue reducing principal while avoiding new high-interest balances.";
    debtMetricLabel = `${round(debtServiceRatio * 100)}% payment-to-income`;
  }

  const overduePoints = hasBills
    ? clamp(8 - bills.overdueCount * 3, 0, 8)
    : 0;
  const reliabilityPoints = !hasBills
    ? 0
    : bills.paidCount > 0
      ? (bills.paidOnTimeCount / bills.paidCount) * 7
      : bills.overdueCount === 0
        ? 7
        : 0;
  const billPoints = overduePoints + reliabilityPoints;

  const emergencyPoints = clamp((emergencyFundCoverageMonths / 3) * 10, 0, 10);
  const goalPoints = hasGoals ? goalProgress * 5 : 0;
  const planningPoints = hasPlannerData
    ? planner.itemCount >= 5
      ? 5
      : planner.itemCount >= 2
        ? 4
        : 3
    : 0;

  const factors: FinancialHealthFactor[] = [
    factor({
      id: "cash-flow",
      name: "Cash flow",
      points: cashFlowPoints,
      maximum: 25,
      metricValue: cashFlowMargin * 100,
      metricUnit: "percent",
      explanation: !hasTransactions
        ? "No transaction records are available for cash-flow assessment."
        : tx.totalIncome > 0
          ? "Measures how much income remains after every recorded expense and saving contribution."
          : "Income is required before FICONTER can assess cash-flow resilience.",
      action: !hasTransactions
        ? "Record your first income or outflow to activate cash-flow scoring."
        : cashFlowMargin < 0
          ? "Bring recorded outflows below income to restore positive monthly capacity."
          : cashFlowMargin < 0.1
            ? "Create more breathing room by reducing flexible spending or increasing income."
            : "Protect this positive margin and direct part of it toward your priorities.",
    }),
    factor({
      id: "savings",
      name: "Savings rate",
      points: savingsPoints,
      maximum: 20,
      metricValue: savingsRate * 100,
      metricUnit: "percent",
      explanation: !hasTransactions
        ? "No income or saving transactions are available for savings-rate assessment."
        : "Uses the same recorded saving transactions that power your Overview savings rate.",
      action: !hasTransactions
        ? "Record income and a saving contribution to activate savings-rate scoring."
        : savingsRate >= 0.2
          ? "Maintain your saving rhythm and review whether contributions match your priorities."
          : "Work toward recording savings equal to at least 20% of income when feasible.",
    }),
    factor({
      id: "debt",
      name: "Debt position",
      points: debtPoints,
      maximum: 20,
      metricValue: debtServiceRatio * 100,
      metricUnit: "percent",
      metricLabel: debtMetricLabel,
      explanation: debtExplanation,
      action: debtAction,
    }),
    factor({
      id: "bills",
      name: "Bill reliability",
      points: billPoints,
      maximum: 15,
      metricValue: bills.overdueCount,
      metricUnit: "count",
      metricLabel: !hasBills
        ? "No bill records"
        : bills.overdueCount === 0
          ? "No overdue bills"
          : `${bills.overdueCount} overdue bill${bills.overdueCount === 1 ? "" : "s"}`,
      explanation: !hasBills
        ? "No bill records are available for reliability assessment."
        : bills.paidCount > 0
          ? `${bills.paidOnTimeCount} of ${bills.paidCount} recorded paid bills were settled by their due date.`
          : "FICONTER checks overdue and upcoming obligations recorded in Bills.",
      action: !hasBills
        ? "Add recurring or one-time obligations in Bills to activate reliability scoring."
        : bills.overdueCount > 0
          ? "Resolve overdue obligations first and review reminders or autopay settings."
          : "Keep upcoming bills funded and preserve your on-time payment record.",
    }),
    factor({
      id: "emergency-fund",
      name: "Emergency reserve",
      points: emergencyPoints,
      maximum: 10,
      metricValue: emergencyFundCoverageMonths,
      metricUnit: "months",
      explanation:
        averageMonthlyExpenses > 0 || tx.emergencyFundSavings > 0
          ? "Compares recorded Emergency fund contributions with average monthly expenses."
          : "No emergency contribution or expense baseline is available for reserve assessment.",
      action:
        averageMonthlyExpenses <= 0 && tx.emergencyFundSavings <= 0
          ? "Record regular expenses and an Emergency fund contribution to activate reserve scoring."
          : emergencyFundCoverageMonths >= 3
            ? "Maintain at least three months of essential outflows in an accessible reserve."
            : "Build the Emergency fund category toward three months of average expenses.",
    }),
    factor({
      id: "goals",
      name: "Goal progress",
      points: goalPoints,
      maximum: 5,
      metricValue: goalProgress * 100,
      metricUnit: "percent",
      metricLabel:
        goals.count > 0
          ? `${round(goalProgress * 100)}% funded`
          : "No goals tracked",
      explanation:
        goals.count > 0
          ? "Measures progress across every active and completed financial goal."
          : "No goal targets are currently available for assessment.",
      action:
        goals.count > 0
          ? "Keep contributions aligned with target dates and your available cash flow."
          : "Create at least one measurable goal to connect today’s cash flow with a future outcome.",
    }),
    factor({
      id: "planning",
      name: "Planning discipline",
      points: planningPoints,
      maximum: 5,
      metricValue: planner.itemCount,
      metricUnit: "count",
      metricLabel: hasPlannerData
        ? `${planner.itemCount} planned item${planner.itemCount === 1 ? "" : "s"}`
        : "No planning records",
      explanation: hasPlannerData
        ? "Checks whether the current month has a structured planner and categorized targets."
        : "No meaningful Monthly Planner amounts or items are available for assessment.",
      action: hasPlannerData
        ? "Review planned amounts as the month changes so the plan remains realistic."
        : "Add income or outflow items to Monthly Planner to activate planning assessment.",
    }),
  ];

  const score = assessed
    ? Math.round(
        clamp(
          factors.reduce((total, current) => total + current.points, 0),
          0,
          100,
        ),
      )
    : 0;
  const label = assessed ? scoreLabel(score) : "Not assessed";

  const ordered = [...factors].sort(
    (a, b) => a.points / a.maximum - b.points / b.maximum,
  );
  const weakest = ordered[0];
  const strongest = ordered.at(-1) ?? weakest;

  const moduleCoverage =
    (hasBills ? 10 : 0) +
    (hasDebts ? 10 : 0) +
    (hasGoals ? 10 : 0) +
    (hasPlannerData ? 10 : 0);
  const transactionCoverage = clamp(tx.count / 12, 0, 1) * 45;
  const historyCoverage = clamp(tx.activeMonths / 3, 0, 1) * 15;
  const dataCoverage = assessed
    ? Math.round(
        clamp(transactionCoverage + historyCoverage + moduleCoverage, 0, 100),
      )
    : 0;
  const confidence = confidenceFor(dataCoverage);

  const summary = !assessed
    ? "No financial records are available yet. Add your first income, outflow, bill, debt, goal or planner item to begin assessment."
    : tx.count === 0
      ? "Add income and outflow records to complete a meaningful financial-health assessment."
      : `${label}. ${strongest.name} is currently supporting your position, while ${weakest.name.toLowerCase()} offers the clearest opportunity to improve.`;

  return {
    version: "2.0",
    score,
    label,
    summary,
    confidence,
    dataCoverage,
    assessed,
    nextBestAction: assessed
      ? weakest.action
      : "Record your first financial activity to activate the Financial Health Score.",
    metrics: {
      totalIncome: tx.totalIncome,
      totalExpenses: tx.totalExpenses,
      totalSavings: tx.totalSavings,
      netCashFlow,
      cashFlowMargin,
      savingsRate,
      averageMonthlyIncome,
      averageMonthlyExpenses,
      emergencyFundCoverageMonths,
      currentDebt: debts.currentBalance,
      debtProgress,
      debtServiceRatio,
      goalProgress,
      overdueBills: bills.overdueCount,
    },
    factors,
  };
}
