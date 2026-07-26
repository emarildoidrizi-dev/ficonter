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
  | "Declining";

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
  version: "1.0";
  period: NetWorthGrowthPeriod;
  periodLabel: string;
  label: NetWorthGrowthLabel;
  summary: string;
  confidence: "High" | "Moderate" | "Developing";
  dataCoverage: number;
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
    trailingSixMonthGrowth: number;
    projectedTwelveMonthNetWorth: number;
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
    const openingNetWorth = first.netWorth - first.netWorthChange;
    const openingDebt = first.debtOutstanding - first.debtChange;
    const closingDebt = last.debtOutstanding;

    return {
      year,
      openingNetWorth,
      closingNetWorth: last.netWorth,
      change: items.reduce((sum, item) => sum + item.netWorthChange, 0),
      retainedCapital: items.reduce(
        (sum, item) => sum + item.retainedCapital,
        0,
      ),
      debtReduction: openingDebt - closingDebt,
      savingsAllocated: items.reduce((sum, item) => sum + item.savings, 0),
    };
  });
}

export function calculateNetWorthGrowth(
  input: NetWorthGrowthInputs = EMPTY_INPUTS,
  period: NetWorthGrowthPeriod = 12,
): NetWorthGrowthResult {
  const data = normalizeNetWorthGrowthInputs(input);
  const fullMonthly = data.growth.monthly;
  const selectedMonthly =
    period === "all" ? fullMonthly : fullMonthly.slice(-period);
  const first = selectedMonthly[0] ?? null;
  const last = selectedMonthly.at(-1) ?? null;
  const openingNetWorth = first ? first.netWorth - first.netWorthChange : 0;
  const openingDebt = first ? first.debtOutstanding - first.debtChange : 0;
  const currentNetWorth = last?.netWorth ?? 0;
  const currentDebt = last?.debtOutstanding ?? 0;
  const selectedPeriodChange = selectedMonthly.reduce(
    (sum, month) => sum + month.netWorthChange,
    0,
  );
  const selectedMonths = selectedMonthly.length;
  const averageMonthlyGrowth = selectedMonths
    ? selectedPeriodChange / selectedMonths
    : 0;
  const capitalAdded = selectedMonthly.reduce(
    (sum, month) => sum + month.retainedCapital,
    0,
  );
  const savingsAllocated = selectedMonthly.reduce(
    (sum, month) => sum + month.savings,
    0,
  );
  const recordedDebtPayments = selectedMonthly.reduce(
    (sum, month) => sum + month.debtPayments,
    0,
  );
  const netDebtReduction = openingDebt - currentDebt;
  const selectedPeriodGrowthRate =
    openingNetWorth > 0
      ? (selectedPeriodChange / openingNetWorth) * 100
      : null;

  const trailingSix = fullMonthly.slice(-6);
  const trailingSixMonthGrowth = average(
    trailingSix.map((month) => month.netWorthChange),
  );
  const projectedTwelveMonthNetWorth =
    currentNetWorth + trailingSixMonthGrowth * 12;
  const recentThree = fullMonthly.slice(-3);
  const priorThree = fullMonthly.slice(-6, -3);
  const recentThreeMonthAverage = average(
    recentThree.map((month) => month.netWorthChange),
  );
  const priorThreeMonthAverage = average(
    priorThree.map((month) => month.netWorthChange),
  );
  const momentumChange = recentThreeMonthAverage - priorThreeMonthAverage;
  const volatility = standardDeviation(
    trailingSix.map((month) => month.netWorthChange),
  );
  const positiveGrowthMonths = selectedMonthly.filter(
    (month) => month.netWorthChange > 0.01,
  ).length;
  const confidence = confidenceFor(
    data.growth.historyMonths,
    volatility,
    trailingSixMonthGrowth,
  );
  const dataCoverage = clamp(
    Math.round((Math.min(data.growth.historyMonths, 12) / 12) * 85) +
      (data.wealthScore.liabilities.length || fullMonthly.length ? 15 : 0),
    0,
    100,
  );
  const label = labelFor(
    currentNetWorth,
    selectedPeriodChange,
    recentThreeMonthAverage,
    priorThreeMonthAverage,
  );

  const bestMonth = selectedMonthly.length
    ? selectedMonthly.reduce((best, month) =>
        month.netWorthChange > best.netWorthChange ? month : best,
      )
    : null;
  const weakestMonth = selectedMonthly.length
    ? selectedMonthly.reduce((weakest, month) =>
        month.netWorthChange < weakest.netWorthChange ? month : weakest,
      )
    : null;

  let summary = "FICONTER is building enough history to measure net-worth growth.";
  if (selectedMonthly.length) {
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
  if (selectedPeriodChange < 0) {
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

  const insights: NetWorthGrowthInsight[] = [
    {
      id: "growth-direction",
      title:
        selectedPeriodChange >= 0
          ? "Net wealth moved forward"
          : "Net wealth moved backward",
      detail: `${periodLabel(period, selectedMonths)} changed the recorded net-worth position by ${round(selectedPeriodChange, 2)} EUR.`,
      action:
        selectedPeriodChange >= 0
          ? "Protect the monthly activities producing positive growth."
          : "Identify the months and liabilities responsible for the decline.",
      tone: selectedPeriodChange >= 0 ? "positive" : "critical",
    },
    {
      id: "debt-effect",
      title:
        netDebtReduction >= 0
          ? "Liabilities supported progress"
          : "Liabilities reduced progress",
      detail:
        netDebtReduction >= 0
          ? `Outstanding debt fell by ${round(netDebtReduction, 2)} EUR during the selected period.`
          : `Outstanding debt increased by ${round(Math.abs(netDebtReduction), 2)} EUR during the selected period.`,
      action:
        netDebtReduction >= 0
          ? "Continue reducing principal consistently."
          : "Review new debt and minimum-payment pressure.",
      tone: netDebtReduction >= 0 ? "positive" : "warning",
    },
    {
      id: "savings-allocation",
      title: "Savings are tracked as an allocation",
      detail: `${round(savingsAllocated, 2)} EUR of retained capital was allocated to recorded savings. It is shown separately but never added twice to net worth.`,
      action:
        savingsAllocated > 0
          ? "Keep savings contributions aligned with available cash flow."
          : "Record intentional saving contributions when cash flow allows.",
      tone: savingsAllocated > 0 ? "info" : "warning",
    },
    {
      id: "forecast",
      title: "Twelve-month direction",
      detail: `At the trailing six-month pace, recorded net worth would reach approximately ${round(projectedTwelveMonthNetWorth, 2)} EUR in twelve months.`,
      action:
        confidence === "Developing"
          ? "Treat this as an early directional estimate until more history is recorded."
          : "Use the projection as a planning guide, not a guaranteed outcome.",
      tone: projectedTwelveMonthNetWorth >= currentNetWorth ? "info" : "warning",
    },
  ];

  return {
    version: "1.0",
    period,
    periodLabel: periodLabel(period, selectedMonths),
    label,
    summary,
    confidence,
    dataCoverage,
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
