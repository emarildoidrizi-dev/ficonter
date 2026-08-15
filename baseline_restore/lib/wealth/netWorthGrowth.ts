import { AVERAGE_PERIODS, type AveragePeriod } from "@/lib/wealth/averagePeriods";
import {
  normalizeWealthScoreInputs,
  type WealthScoreInputs,
} from "@/lib/wealth/wealthScore";

export const NET_WORTH_GROWTH_PERIODS = [...AVERAGE_PERIODS, "all"] as const;
export type NetWorthGrowthPeriod = AveragePeriod | "all";

export type NetWorthGrowthMonth = {
  month: string;
  transactionCount: number;
  income: number;
  expenses: number;
  savings: number;
  retainedCapital: number;
  availableCashChange: number;
  cumulativeCapital: number;
  cumulativeSavings: number;
  debtOutstanding: number;
  debtPayments: number;
  debtChange: number;
  netWorth: number;
  netWorthChange: number;
};

export type NetWorthGrowthInputs = {
  schemaVersion: number;
  generatedAt: string;
  wealthScore: WealthScoreInputs;
  growth: {
    firstMonth: string | null;
    historyMonths: number;
    monthly: NetWorthGrowthMonth[];
  };
};

export type NetWorthGrowthLabel =
  | "Accelerating"
  | "Growing"
  | "Recovering"
  | "Flat"
  | "Declining"
  | "Not enough history";

export type NetWorthGrowthInsightTone =
  | "positive"
  | "info"
  | "warning"
  | "critical";

export type NetWorthGrowthInsight = {
  id: string;
  title: string;
  detail: string;
  action: string;
  tone: NetWorthGrowthInsightTone;
};

export type NetWorthGrowthYear = {
  year: string;
  openingNetWorth: number;
  closingNetWorth: number;
  change: number;
  retainedCapital: number;
  debtReduction: number;
  savingsAllocated: number;
};

export type NetWorthGrowthResult = {
  version: "1.1";
  period: NetWorthGrowthPeriod;
  periodLabel: string;
  label: NetWorthGrowthLabel;
  summary: string;
  confidence: "High" | "Moderate" | "Developing" | "No data";
  dataCoverage: number;
  hasHistory: boolean;
  nextBestAction: string;
  metrics: {
    currentNetWorth: number;
    openingNetWorth: number;
    selectedPeriodChange: number;
    selectedPeriodGrowthRate: number | null;
    averageMonthlyGrowth: number;
    capitalAdded: number;
    savingsAllocated: number;
    recordedDebtPayments: number;
    netDebtReduction: number;
    currentDebt: number;
    openingDebt: number;
    forecastAvailable: boolean;
    forecastHistoryMonths: number;
    trailingSixMonthGrowth: number | null;
    projectedTwelveMonthNetWorth: number | null;
    recentThreeMonthAverage: number;
    priorThreeMonthAverage: number;
    momentumChange: number;
    volatility: number;
    positiveGrowthMonths: number;
    selectedMonths: number;
  };
  selectedMonthly: NetWorthGrowthMonth[];
  fullMonthly: NetWorthGrowthMonth[];
  annual: NetWorthGrowthYear[];
  bestMonth: NetWorthGrowthMonth | null;
  weakestMonth: NetWorthGrowthMonth | null;
  insights: NetWorthGrowthInsight[];
};

const EMPTY_INPUTS: NetWorthGrowthInputs = {
  schemaVersion: 1,
  generatedAt: new Date(0).toISOString(),
  wealthScore: normalizeWealthScoreInputs(null),
  growth: {
    firstMonth: null,
    historyMonths: 0,
    monthly: [],
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

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function currencyText(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(round(value, 2));
}


function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function average(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function normalizeMonth(value: unknown): NetWorthGrowthMonth {
  const row = object(value);
  return {
    month: string(row.month),
    transactionCount: integer(row.transactionCount),
    income: finite(row.income),
    expenses: finite(row.expenses),
    savings: finite(row.savings),
    retainedCapital: finite(row.retainedCapital),
    availableCashChange: finite(row.availableCashChange),
    cumulativeCapital: finite(row.cumulativeCapital),
    cumulativeSavings: finite(row.cumulativeSavings),
    debtOutstanding: Math.max(0, finite(row.debtOutstanding)),
    debtPayments: Math.max(0, finite(row.debtPayments)),
    debtChange: finite(row.debtChange),
    netWorth: finite(row.netWorth),
    netWorthChange: finite(row.netWorthChange),
  };
}

export function normalizeNetWorthGrowthInputs(
  value: unknown,
): NetWorthGrowthInputs {
  const root = object(value);
  const growth = object(root.growth);
  const monthly = array(growth.monthly)
    .map(normalizeMonth)
    .filter((month) => /^\d{4}-\d{2}$/.test(month.month));

  return {
    schemaVersion: integer(root.schemaVersion) || 1,
    generatedAt: string(root.generatedAt, new Date().toISOString()),
    wealthScore: normalizeWealthScoreInputs(root),
    growth: {
      firstMonth:
        typeof growth.firstMonth === "string" ? growth.firstMonth : null,
      historyMonths: integer(growth.historyMonths) || monthly.length,
      monthly,
    },
  };
}

function periodLabel(period: NetWorthGrowthPeriod, selectedMonths: number): string {
  if (period === "all") {
    return selectedMonths === 1 ? "Full recorded month" : "Full recorded history";
  }
  return `Last ${period} months`;
}

function confidenceFor(
  historyMonths: number,
  volatility: number,
  monthlyAverage: number,
): NetWorthGrowthResult["confidence"] {
  if (historyMonths <= 0) return "No data";
  const volatilityRatio =
    Math.abs(monthlyAverage) > 1 ? volatility / Math.abs(monthlyAverage) : volatility;

  if (historyMonths >= 12 && volatilityRatio <= 2.5) return "High";
  if (historyMonths >= 6) return "Moderate";
  return "Developing";
}

function labelFor(
  currentNetWorth: number,
  selectedChange: number,
  recentAverage: number,
  priorAverage: number,
): NetWorthGrowthLabel {
  if (selectedChange < -1) return "Declining";
  if (currentNetWorth < 0 && selectedChange > 1) return "Recovering";
  if (selectedChange <= 1 && selectedChange >= -1) return "Flat";
  if (recentAverage > priorAverage + Math.max(25, Math.abs(priorAverage) * 0.15)) {
    return "Accelerating";
  }
  return "Growing";
}

function groupAnnual(months: readonly NetWorthGrowthMonth[]): NetWorthGrowthYear[] {
  const groups = new Map<string, NetWorthGrowthMonth[]>();
  months.forEach((month) => {
    const year = month.month.slice(0, 4);
    const existing = groups.get(year) ?? [];
    existing.push(month);
    groups.set(year, existing);
  });

  return [...groups.entries()].map(([year, items]) => {
    const first = items[0];
    const last = items.at(-1) ?? first;
    const firstIndex = months.findIndex((month) => month.month === first.month);
    const previous = firstIndex > 0 ? months[firstIndex - 1] : null;
    const openingNetWorth = previous?.netWorth ?? first.netWorth;
    const openingDebt = previous?.debtOutstanding ?? first.debtOutstanding;
    const comparableItems = previous ? items : items.slice(1);

    return {
      year,
      openingNetWorth,
      closingNetWorth: last.netWorth,
      change: last.netWorth - openingNetWorth,
      retainedCapital: comparableItems.reduce(
        (sum, item) => sum + item.retainedCapital,
        0,
      ),
      debtReduction: openingDebt - last.debtOutstanding,
      savingsAllocated: comparableItems.reduce(
        (sum, item) => sum + item.savings,
        0,
      ),
    };
  });
}

export function calculateNetWorthGrowth(
  input: NetWorthGrowthInputs = EMPTY_INPUTS,
  period: NetWorthGrowthPeriod = 12,
): NetWorthGrowthResult {
  const data = normalizeNetWorthGrowthInputs(input);
  const fullMonthly = data.growth.monthly;
  const generatedMonth = /^\d{4}-\d{2}/.test(data.generatedAt)
    ? data.generatedAt.slice(0, 7)
    : new Date().toISOString().slice(0, 7);
  const completedMonthly = fullMonthly.filter(
    (month) => month.month < generatedMonth,
  );
  const selectedMonthly =
    period === "all" ? fullMonthly : fullMonthly.slice(-period);
  const selectedCompletedMonthly =
    period === "all" ? completedMonthly : completedMonthly.slice(-period);
  const liveCurrent = fullMonthly.at(-1) ?? null;
  const firstComparable = selectedCompletedMonthly[0] ?? null;
  const lastComparable = selectedCompletedMonthly.at(-1) ?? null;
  // Only completed calendar months may create a comparable growth change. The
  // current open month remains visible as the live position, but is not treated
  // as a completed month-end result.
  const selectedGrowthMonths = selectedCompletedMonthly.slice(1);
  const openingNetWorth =
    firstComparable?.netWorth ?? liveCurrent?.netWorth ?? 0;
  const openingDebt =
    firstComparable?.debtOutstanding ?? liveCurrent?.debtOutstanding ?? 0;
  const currentNetWorth = liveCurrent?.netWorth ?? 0;
  const currentDebt = liveCurrent?.debtOutstanding ?? 0;
  const selectedPeriodChange =
    firstComparable && lastComparable && selectedGrowthMonths.length
      ? lastComparable.netWorth - firstComparable.netWorth
      : 0;
  const selectedMonths = selectedGrowthMonths.length;
  const averageMonthlyGrowth = selectedMonths
    ? selectedPeriodChange / selectedMonths
    : 0;
  const capitalAdded = selectedGrowthMonths.reduce(
    (sum, month) => sum + month.retainedCapital,
    0,
  );
  const savingsAllocated = selectedGrowthMonths.reduce(
    (sum, month) => sum + month.savings,
    0,
  );
  const recordedDebtPayments = selectedGrowthMonths.reduce(
    (sum, month) => sum + month.debtPayments,
    0,
  );
  const netDebtReduction =
    selectedGrowthMonths.length && lastComparable
      ? openingDebt - lastComparable.debtOutstanding
      : 0;
  const selectedPeriodGrowthRate =
    openingNetWorth > 0 && selectedGrowthMonths.length
      ? (selectedPeriodChange / openingNetWorth) * 100
      : null;

  // The first completed month establishes the opening baseline. It must never be
  // treated as a recurring monthly gain or loss for forecasting.
  const completedGrowthMonths = completedMonthly.slice(1);
  const forecastSample = completedGrowthMonths.slice(-6);
  const forecastHistoryMonths = forecastSample.length;
  const forecastAvailable = forecastHistoryMonths >= 3;
  const trailingSixMonthGrowth = forecastAvailable
    ? average(forecastSample.map((month) => month.netWorthChange))
    : null;
  const projectedTwelveMonthNetWorth =
    forecastAvailable && trailingSixMonthGrowth !== null
      ? currentNetWorth + trailingSixMonthGrowth * 12
      : null;
  const comparableGrowthMonths = completedGrowthMonths;
  const recentThree = comparableGrowthMonths.slice(-3);
  const priorThree = comparableGrowthMonths.slice(-6, -3);
  const recentThreeMonthAverage = average(
    recentThree.map((month) => month.netWorthChange),
  );
  const priorThreeMonthAverage = average(
    priorThree.map((month) => month.netWorthChange),
  );
  const momentumChange = recentThreeMonthAverage - priorThreeMonthAverage;
  const trailingGrowthMonths = comparableGrowthMonths.slice(-6);
  const volatility = standardDeviation(
    trailingGrowthMonths.map((month) => month.netWorthChange),
  );
  const positiveGrowthMonths = selectedGrowthMonths.filter(
    (month) => month.netWorthChange > 0.01,
  ).length;
  const comparableHistoryMonths = completedGrowthMonths.length;
  const hasMeaningfulWealthData =
    data.wealthScore.financialHealth.transactions.count > 0 ||
    data.wealthScore.financialHealth.debts.count > 0 ||
    data.wealthScore.liabilities.length > 0 ||
    fullMonthly.some(
      (month) =>
        month.transactionCount > 0 ||
        Math.abs(month.cumulativeCapital) > 0.005 ||
        Math.abs(month.debtOutstanding) > 0.005,
    );
  const hasHistory = hasMeaningfulWealthData && comparableHistoryMonths > 0;
  const confidence = confidenceFor(
    comparableHistoryMonths,
    volatility,
    trailingSixMonthGrowth ?? 0,
  );
  const dataCoverage = hasHistory
    ? clamp(
        Math.round((Math.min(comparableHistoryMonths, 12) / 12) * 85) +
          (data.wealthScore.liabilities.length || comparableHistoryMonths > 0
            ? 15
            : 0),
        0,
        100,
      )
    : 0;
  const label = hasHistory
    ? labelFor(
        currentNetWorth,
        selectedPeriodChange,
        recentThreeMonthAverage,
        priorThreeMonthAverage,
      )
    : "Not enough history";

  const bestMonth = selectedGrowthMonths.length
    ? selectedGrowthMonths.reduce((best, month) =>
        month.netWorthChange > best.netWorthChange ? month : best,
      )
    : null;
  const weakestMonth = selectedGrowthMonths.length
    ? selectedGrowthMonths.reduce((weakest, month) =>
        month.netWorthChange < weakest.netWorthChange ? month : weakest,
      )
    : null;

  let summary = hasMeaningfulWealthData
    ? "FICONTER is building enough month-end history to measure net-worth growth."
    : "No net-worth activity is available yet. Add financial records to establish the first baseline.";
  if (hasHistory && selectedGrowthMonths.length) {
    if (label === "Declining") {
      summary =
        "Net wealth moved backward during the selected period. The breakdown shows whether cash-flow pressure or rising liabilities caused the change.";
    } else if (label === "Recovering") {
      summary =
        "Net wealth is still below zero, but the recorded position improved during the selected period.";
    } else if (label === "Flat") {
      summary =
        "Net wealth was broadly stable during the selected period, with limited movement in either direction.";
    } else if (label === "Accelerating") {
      summary =
        "Net wealth is growing and the latest three-month pace is stronger than the preceding period.";
    } else {
      summary =
        "Net wealth increased during the selected period through retained capital, debt reduction, or both.";
    }
  }

  let nextBestAction =
    "Keep recording transactions and liabilities so FICONTER can measure a reliable growth trend.";
  if (!selectedGrowthMonths.length) {
    nextBestAction =
      "Keep recording complete monthly activity. FICONTER needs comparable month-end positions before it can measure growth.";
  } else if (selectedPeriodChange < 0) {
    nextBestAction =
      "Restore positive monthly retained capital and avoid adding new liabilities until net-worth growth turns positive.";
  } else if (netDebtReduction < 0) {
    nextBestAction =
      "New or increased liabilities are offsetting progress. Prioritize principal reduction before expanding commitments.";
  } else if (capitalAdded <= 0) {
    nextBestAction =
      "Improve monthly cash flow so income consistently exceeds expenses and creates new capital.";
  } else if (savingsAllocated <= 0) {
    nextBestAction =
      "Direct part of positive retained capital into recorded savings to make wealth-building intentional and visible.";
  } else if (momentumChange < 0) {
    nextBestAction =
      "Protect the positive trend and reverse the recent slowdown in monthly net-worth growth.";
  } else {
    nextBestAction =
      "Maintain positive retained capital and consistent debt reduction to preserve wealth momentum.";
  }

  const insights: NetWorthGrowthInsight[] = !hasMeaningfulWealthData
    ? [
        {
          id: "no-data",
          title: "Net-worth growth is waiting for records",
          detail:
            "No transaction, capital or liability history is available for a growth comparison yet.",
          action:
            "Record your first financial activity to establish the opening net-worth baseline.",
          tone: "info",
        },
      ]
    : [
        {
          id: "growth-direction",
          title: selectedGrowthMonths.length
            ? selectedPeriodChange >= 0
              ? "Net wealth moved forward"
              : "Net wealth moved backward"
            : "Net-worth baseline established",
          detail: selectedGrowthMonths.length
            ? `${periodLabel(period, selectedMonthly.length)} changed the recorded net-worth position by ${currencyText(selectedPeriodChange)}.`
            : `FICONTER has recorded the current net-worth position of ${currencyText(currentNetWorth)}, but no comparable month-end change exists yet.`,
          action: selectedGrowthMonths.length
            ? selectedPeriodChange >= 0
              ? "Protect the monthly activities producing positive growth."
              : "Identify the months and liabilities responsible for the decline."
            : "Keep recording activity until at least two month-end positions can be compared.",
          tone: selectedGrowthMonths.length
            ? selectedPeriodChange >= 0
              ? "positive"
              : "critical"
            : "info",
        },
        {
          id: "debt-effect",
          title: !selectedGrowthMonths.length
            ? "Liability movement awaiting comparison"
            : netDebtReduction >= 0
              ? "Liabilities supported progress"
              : "Liabilities reduced progress",
          detail: !selectedGrowthMonths.length
            ? "The current liability balance is recorded, but no earlier comparable month-end position exists yet."
            : netDebtReduction >= 0
              ? `Outstanding debt fell by ${currencyText(netDebtReduction)} during the selected period.`
              : `Outstanding debt increased by ${currencyText(Math.abs(netDebtReduction))} during the selected period.`,
          action: !selectedGrowthMonths.length
            ? "Keep recording debt balances and payments until two month-end positions can be compared."
            : netDebtReduction >= 0
              ? "Continue reducing principal consistently."
              : "Review new debt and minimum-payment pressure.",
          tone: !selectedGrowthMonths.length
            ? "info"
            : netDebtReduction >= 0
              ? "positive"
              : "warning",
        },
        {
          id: "savings-allocation",
          title: "Savings are tracked as an allocation",
          detail: !selectedGrowthMonths.length
            ? "Recorded savings remain part of capital, but a comparable-period allocation cannot be calculated until another month-end position exists."
            : `${currencyText(savingsAllocated)} of retained capital was allocated to recorded savings. It is shown separately but never added twice to net worth.`,
          action: !selectedGrowthMonths.length
            ? "Keep recording complete monthly activity until savings allocation can be compared across month ends."
            : savingsAllocated > 0
              ? "Keep savings contributions aligned with available cash flow."
              : "Record intentional saving contributions when cash flow allows.",
          tone: selectedGrowthMonths.length && savingsAllocated <= 0 ? "warning" : "info",
        },
        {
          id: "forecast",
          title: forecastAvailable
            ? "Twelve-month direction"
            : "Outlook needs more history",
          detail:
            forecastAvailable && projectedTwelveMonthNetWorth !== null
              ? `At the trailing completed-month pace, recorded net worth would reach approximately ${currencyText(projectedTwelveMonthNetWorth)} in twelve months.`
              : `FICONTER has ${forecastHistoryMonths} of the 3 completed month-to-month changes required for a responsible outlook.`,
          action: forecastAvailable
            ? "Use the projection as a planning guide, not a guaranteed outcome."
            : "Keep recording complete monthly activity. The forecast will activate automatically when enough history exists.",
          tone:
            forecastAvailable &&
            projectedTwelveMonthNetWorth !== null &&
            projectedTwelveMonthNetWorth < currentNetWorth
              ? "warning"
              : "info",
        },
      ];

  return {
    version: "1.1",
    period,
    periodLabel: periodLabel(period, selectedMonthly.length),
    label,
    summary,
    confidence,
    dataCoverage,
    hasHistory,
    nextBestAction,
    metrics: {
      currentNetWorth,
      openingNetWorth,
      selectedPeriodChange,
      selectedPeriodGrowthRate,
      averageMonthlyGrowth,
      capitalAdded,
      savingsAllocated,
      recordedDebtPayments,
      netDebtReduction,
      currentDebt,
      openingDebt,
      forecastAvailable,
      forecastHistoryMonths,
      trailingSixMonthGrowth,
      projectedTwelveMonthNetWorth,
      recentThreeMonthAverage,
      priorThreeMonthAverage,
      momentumChange,
      volatility,
      positiveGrowthMonths,
      selectedMonths,
    },
    selectedMonthly,
    fullMonthly,
    annual: groupAnnual(fullMonthly),
    bestMonth,
    weakestMonth,
    insights,
  };
}
