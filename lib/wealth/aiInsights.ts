import {
  calculateCashFlowIntelligence,
  normalizeCashFlowIntelligenceInputs,
  type CashFlowIntelligenceInputs,
  type CashFlowIntelligenceResult,
} from "@/lib/wealth/cashFlowIntelligence";
import {
  calculateFinancialIndependence,
  normalizeFinancialIndependenceInputs,
  type FinancialIndependenceInputs,
  type FinancialIndependenceResult,
} from "@/lib/wealth/financialIndependence";
import { calculateWealthScore } from "@/lib/wealth/wealthScore";
import { confidenceFromCoverage, type DataConfidence } from "@/lib/wealth/dataReadiness";

export const AI_INSIGHTS_CONSENT_VERSION = "2026-07-26";
export const AI_INSIGHTS_CACHE_HOURS = 24;

export type AiInsightPreferences = {
  enabled: boolean;
  consentVersion: string | null;
  consentedAt: string | null;
  updatedAt: string | null;
};

export type AiInsightsInputs = {
  schemaVersion: number;
  generatedAt: string;
  cashFlow: CashFlowIntelligenceInputs;
  financialIndependence: FinancialIndependenceInputs;
  preferences: AiInsightPreferences;
};

export type AiInsightDomain =
  | "Financial health"
  | "Cash flow"
  | "Savings"
  | "Emergency fund"
  | "Debt"
  | "Bills"
  | "Goals"
  | "Net worth"
  | "Financial independence"
  | "Planning";

export type AiInsightPriority = "critical" | "high" | "medium" | "low";

export type AiEvidenceKey =
  | "financial_health_score"
  | "financial_health_status"
  | "cash_flow_margin"
  | "current_month_net_flow"
  | "projected_30_day_net_flow"
  | "known_commitments"
  | "savings_rate"
  | "monthly_savings_pace"
  | "savings_target_gap"
  | "emergency_reserve"
  | "emergency_months"
  | "emergency_gap"
  | "current_debt"
  | "debt_service_ratio"
  | "overdue_bills"
  | "goal_progress"
  | "wealth_score"
  | "net_worth"
  | "capital_to_debt_ratio"
  | "six_month_net_worth_change"
  | "financial_independence_progress"
  | "financial_independence_target"
  | "monthly_freedom_income"
  | "planner_status";

export type AiInsightItem = {
  domain: AiInsightDomain;
  priority: AiInsightPriority;
  title: string;
  insight: string;
  action: string;
  evidenceKeys: AiEvidenceKey[];
};

export type AiActionStep = {
  order: number;
  horizon: "This week" | "This month" | "Next 90 days" | "Ongoing";
  title: string;
  action: string;
  evidenceKeys: AiEvidenceKey[];
};

export type AiInsightReport = {
  schemaVersion: 1;
  headline: string;
  summary: string;
  position:
    | "Not assessed"
    | "At risk"
    | "Needs attention"
    | "Stable"
    | "Building"
    | "Strong";
  priorities: AiInsightItem[];
  opportunities: AiInsightItem[];
  watchlist: AiInsightItem[];
  actionPlan: AiActionStep[];
  dataLimitations: string[];
  disclaimer: string;
};

export type AiInsightSnapshot = {
  id: string;
  dataFingerprint: string;
  report: AiInsightReport;
  model: string;
  dataCoverage: number;
  generatedAt: string;
};

export type AiEvidenceFormat =
  | "currency"
  | "percent"
  | "number"
  | "ratio"
  | "months"
  | "score"
  | "status";

export type AiEvidenceMetric = {
  key: AiEvidenceKey;
  label: string;
  value: number | string | null;
  format: AiEvidenceFormat;
  domain: AiInsightDomain;
};

export type AiInsightsContext = {
  assessed: boolean;
  dataCoverage: number;
  confidence: DataConfidence;
  connectedSources: number;
  totalSources: number;
  fingerprint: string;
  evidence: Record<AiEvidenceKey, AiEvidenceMetric>;
  promptPayload: Record<string, unknown>;
  sources: {
    cashFlow: CashFlowIntelligenceResult;
    financialIndependence: FinancialIndependenceResult;
  };
};

const EMPTY_INPUTS: AiInsightsInputs = {
  schemaVersion: 1,
  generatedAt: new Date(0).toISOString(),
  cashFlow: normalizeCashFlowIntelligenceInputs(null),
  financialIndependence: normalizeFinancialIndependenceInputs(null),
  preferences: {
    enabled: false,
    consentVersion: null,
    consentedAt: null,
    updatedAt: null,
  },
};

const EVIDENCE_KEYS: readonly AiEvidenceKey[] = [
  "financial_health_score",
  "financial_health_status",
  "cash_flow_margin",
  "current_month_net_flow",
  "projected_30_day_net_flow",
  "known_commitments",
  "savings_rate",
  "monthly_savings_pace",
  "savings_target_gap",
  "emergency_reserve",
  "emergency_months",
  "emergency_gap",
  "current_debt",
  "debt_service_ratio",
  "overdue_bills",
  "goal_progress",
  "wealth_score",
  "net_worth",
  "capital_to_debt_ratio",
  "six_month_net_worth_change",
  "financial_independence_progress",
  "financial_independence_target",
  "monthly_freedom_income",
  "planner_status",
] as const;

const DOMAINS: readonly AiInsightDomain[] = [
  "Financial health",
  "Cash flow",
  "Savings",
  "Emergency fund",
  "Debt",
  "Bills",
  "Goals",
  "Net worth",
  "Financial independence",
  "Planning",
] as const;

const PRIORITIES: readonly AiInsightPriority[] = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

const POSITIONS: readonly AiInsightReport["position"][] = [
  "Not assessed",
  "At risk",
  "Needs attention",
  "Stable",
  "Building",
  "Strong",
] as const;

const HORIZONS: readonly AiActionStep["horizon"][] = [
  "This week",
  "This month",
  "Next 90 days",
  "Ongoing",
] as const;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function integer(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function string(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundedCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function validEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function cleanText(value: unknown, maximum: number, fallback = ""): string {
  return string(value, fallback).replace(/\s+/g, " ").trim().slice(0, maximum);
}

function stableHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 0x01000193);
    second ^= code + index;
    second = Math.imul(second, 0x85ebca6b);
  }

  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

function compactSpendingCategory(value: {
  category: string;
  recentAmount: number;
  share: number;
}) {
  return {
    category: value.category.slice(0, 80),
    amount: roundedCurrency(value.recentAmount),
    share: round(value.share, 1),
  };
}

function compactSavingsCategory(value: {
  category: string;
  amount: number;
  share: number;
}) {
  return {
    category: value.category.slice(0, 80),
    amount: roundedCurrency(value.amount),
    share: round(value.share, 1),
  };
}

export function normalizeAiInsightsInputs(value: unknown): AiInsightsInputs {
  const root = object(value);
  const preferences = object(root.preferences);

  return {
    schemaVersion: integer(root.schemaVersion) || 1,
    generatedAt:
      typeof root.generatedAt === "string"
        ? root.generatedAt
        : new Date().toISOString(),
    cashFlow: normalizeCashFlowIntelligenceInputs(root.cashFlow),
    financialIndependence: normalizeFinancialIndependenceInputs(
      root.financialIndependence,
    ),
    preferences: {
      enabled: preferences.enabled === true,
      consentVersion: nullableString(preferences.consentVersion),
      consentedAt: nullableString(preferences.consentedAt),
      updatedAt: nullableString(preferences.updatedAt),
    },
  };
}

export function calculateAiInsightsContext(
  input: AiInsightsInputs = EMPTY_INPUTS,
): AiInsightsContext {
  const normalized = normalizeAiInsightsInputs(input);
  const cashFlow = calculateCashFlowIntelligence(normalized.cashFlow);
  const financialIndependence = calculateFinancialIndependence(
    normalized.financialIndependence,
  );
  const savings = financialIndependence.sources.savings;
  const emergency = financialIndependence.sources.emergency;
  const growth = financialIndependence.sources.growth;
  const health = cashFlow.health;
  const wealth = calculateWealthScore(
    normalized.financialIndependence.netWorthGrowth.wealthScore,
  );

  const assessed =
    health.assessed ||
    wealth.assessed ||
    cashFlow.forecastAvailable ||
    savings.hasSavingsData ||
    emergency.metrics.averageMonthlyExpenses > 0 ||
    growth.hasHistory ||
    financialIndependence.assessed;

  const sourceCoverages = [
    health.dataCoverage,
    cashFlow.dataCoverage,
    savings.dataCoverage,
    emergency.dataCoverage,
    wealth.dataCoverage,
    growth.dataCoverage,
    financialIndependence.dataCoverage,
  ];
  const connectedSources = sourceCoverages.filter((value) => value > 0).length;
  const dataCoverage = assessed
    ? Math.round(
        health.dataCoverage * 0.2 +
          cashFlow.dataCoverage * 0.15 +
          savings.dataCoverage * 0.15 +
          emergency.dataCoverage * 0.15 +
          wealth.dataCoverage * 0.15 +
          growth.dataCoverage * 0.1 +
          financialIndependence.dataCoverage * 0.1,
      )
    : 0;

  const plannerStatus = normalized.cashFlow.planner.hasPlan
    ? "Current-month planner active"
    : "No current-month planner";

  const evidence: Record<AiEvidenceKey, AiEvidenceMetric> = {
    financial_health_score: {
      key: "financial_health_score",
      label: "Financial Health Score",
      value: health.score,
      format: "score",
      domain: "Financial health",
    },
    financial_health_status: {
      key: "financial_health_status",
      label: "Financial health status",
      value: health.label,
      format: "status",
      domain: "Financial health",
    },
    cash_flow_margin: {
      key: "cash_flow_margin",
      label: "Cash-flow margin",
      value: health.metrics.cashFlowMargin,
      format: "percent",
      domain: "Cash flow",
    },
    current_month_net_flow: {
      key: "current_month_net_flow",
      label: "Current-month net flow",
      value: cashFlow.metrics.currentMonthNetCashFlow,
      format: "currency",
      domain: "Cash flow",
    },
    projected_30_day_net_flow: {
      key: "projected_30_day_net_flow",
      label: "Projected 30-day net flow",
      value: cashFlow.forecastAvailable
        ? cashFlow.metrics.projectedNetCashFlow
        : null,
      format: "currency",
      domain: "Cash flow",
    },
    known_commitments: {
      key: "known_commitments",
      label: "Known 30-day commitments",
      value: cashFlow.metrics.knownCommitments,
      format: "currency",
      domain: "Bills",
    },
    savings_rate: {
      key: "savings_rate",
      label: "Savings rate",
      value: savings.metrics.savingsRate,
      format: "percent",
      domain: "Savings",
    },
    monthly_savings_pace: {
      key: "monthly_savings_pace",
      label: "Six-month savings pace",
      value: savings.metrics.baselineMonthlySavings,
      format: "currency",
      domain: "Savings",
    },
    savings_target_gap: {
      key: "savings_target_gap",
      label: "Monthly savings target gap",
      value: savings.metrics.monthlyGap,
      format: "currency",
      domain: "Savings",
    },
    emergency_reserve: {
      key: "emergency_reserve",
      label: "Emergency reserve",
      value: emergency.metrics.currentBalance,
      format: "currency",
      domain: "Emergency fund",
    },
    emergency_months: {
      key: "emergency_months",
      label: "Expenses covered",
      value: emergency.metrics.coverageMonths,
      format: "months",
      domain: "Emergency fund",
    },
    emergency_gap: {
      key: "emergency_gap",
      label: "Emergency reserve gap",
      value: emergency.metrics.recommendedGap,
      format: "currency",
      domain: "Emergency fund",
    },
    current_debt: {
      key: "current_debt",
      label: "Current debt",
      value: health.metrics.currentDebt,
      format: "currency",
      domain: "Debt",
    },
    debt_service_ratio: {
      key: "debt_service_ratio",
      label: "Debt payment-to-income ratio",
      value: health.metrics.debtServiceRatio,
      format: "percent",
      domain: "Debt",
    },
    overdue_bills: {
      key: "overdue_bills",
      label: "Overdue bills",
      value: health.metrics.overdueBills,
      format: "number",
      domain: "Bills",
    },
    goal_progress: {
      key: "goal_progress",
      label: "Goal progress",
      value: health.metrics.goalProgress,
      format: "percent",
      domain: "Goals",
    },
    wealth_score: {
      key: "wealth_score",
      label: "Wealth Score",
      value: wealth.score,
      format: "score",
      domain: "Net worth",
    },
    net_worth: {
      key: "net_worth",
      label: "Net worth",
      value: growth.metrics.currentNetWorth,
      format: "currency",
      domain: "Net worth",
    },
    capital_to_debt_ratio: {
      key: "capital_to_debt_ratio",
      label: "Capital-to-debt ratio",
      value: wealth.metrics.capitalToDebtRatio,
      format: "ratio",
      domain: "Net worth",
    },
    six_month_net_worth_change: {
      key: "six_month_net_worth_change",
      label: "Six-month net-worth change",
      value: growth.hasHistory ? growth.metrics.trailingSixMonthGrowth : null,
      format: "currency",
      domain: "Net worth",
    },
    financial_independence_progress: {
      key: "financial_independence_progress",
      label: "Financial Independence progress",
      value: financialIndependence.metrics.progress,
      format: "percent",
      domain: "Financial independence",
    },
    financial_independence_target: {
      key: "financial_independence_target",
      label: "Financial Independence target",
      value: financialIndependence.metrics.financialIndependenceTarget,
      format: "currency",
      domain: "Financial independence",
    },
    monthly_freedom_income: {
      key: "monthly_freedom_income",
      label: "Current monthly freedom income",
      value: financialIndependence.metrics.monthlyFreedomIncome,
      format: "currency",
      domain: "Financial independence",
    },
    planner_status: {
      key: "planner_status",
      label: "Planning status",
      value: plannerStatus,
      format: "status",
      domain: "Planning",
    },
  };

  const promptPayload = {
    schemaVersion: 1,
    currency: "EUR",
    dataCoverage,
    sourceStatus: {
      financialHealth: {
        assessed: health.assessed,
        score: health.score,
        label: health.label,
        coverage: health.dataCoverage,
        nextBestAction: health.nextBestAction,
      },
      cashFlow: {
        assessed: cashFlow.dataCoverage > 0,
        label: cashFlow.label,
        coverage: cashFlow.dataCoverage,
        forecastAvailable: cashFlow.forecastAvailable,
        nextBestAction: cashFlow.nextBestAction,
      },
      savings: {
        assessed: savings.hasSavingsData,
        label: savings.status,
        coverage: savings.dataCoverage,
        nextBestAction: savings.nextBestAction,
      },
      emergencyFund: {
        assessed: emergency.dataCoverage > 0,
        label: emergency.status,
        coverage: emergency.dataCoverage,
        nextBestAction: emergency.nextBestAction,
      },
      wealth: {
        assessed: wealth.assessed,
        score: wealth.score,
        label: wealth.label,
        coverage: wealth.dataCoverage,
        nextBestAction: wealth.nextBestAction,
      },
      netWorthGrowth: {
        assessed: growth.hasHistory,
        label: growth.label,
        coverage: growth.dataCoverage,
        nextBestAction: growth.nextBestAction,
      },
      financialIndependence: {
        assessed: financialIndependence.assessed,
        label: financialIndependence.stage,
        coverage: financialIndependence.dataCoverage,
        nextBestAction: financialIndependence.nextBestAction,
      },
    },
    metrics: Object.fromEntries(
      EVIDENCE_KEYS.map((key) => [
        key,
        {
          value: evidence[key].value,
          format: evidence[key].format,
          domain: evidence[key].domain,
        },
      ]),
    ),
    topSpendingCategories: cashFlow.categories
      .slice(0, 5)
      .map(compactSpendingCategory),
    topSavingsCategories: savings.categories
      .slice(0, 5)
      .map(compactSavingsCategory),
    dataRules: {
      noRawTransactions: true,
      noUserIdentity: true,
      noVendorDescriptions: true,
      evidenceKeysOnly: true,
    },
  };

  const fingerprint = `smart-v1-${stableHash(JSON.stringify(promptPayload))}`;

  return {
    assessed,
    dataCoverage: clamp(dataCoverage, 0, 100),
    confidence: confidenceFromCoverage(dataCoverage),
    connectedSources,
    totalSources: sourceCoverages.length,
    fingerprint,
    evidence,
    promptPayload,
    sources: {
      cashFlow,
      financialIndependence,
    },
  };
}

function normalizeEvidenceKeys(value: unknown): AiEvidenceKey[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (entry): entry is AiEvidenceKey =>
          typeof entry === "string" &&
          EVIDENCE_KEYS.includes(entry as AiEvidenceKey),
      ),
    ),
  ).slice(0, 4);
}

function normalizeItem(value: unknown): AiInsightItem | null {
  const row = object(value);
  const title = cleanText(row.title, 110);
  const insight = cleanText(row.insight, 360);
  const action = cleanText(row.action, 260);
  if (!title || !insight || !action) return null;

  return {
    domain: validEnum(row.domain, DOMAINS, "Financial health"),
    priority: validEnum(row.priority, PRIORITIES, "medium"),
    title,
    insight,
    action,
    evidenceKeys: normalizeEvidenceKeys(row.evidenceKeys),
  };
}

function normalizeAction(value: unknown, index: number): AiActionStep | null {
  const row = object(value);
  const title = cleanText(row.title, 110);
  const action = cleanText(row.action, 280);
  if (!title || !action) return null;

  return {
    order: clamp(integer(row.order) || index + 1, 1, 9),
    horizon: validEnum(row.horizon, HORIZONS, "This month"),
    title,
    action,
    evidenceKeys: normalizeEvidenceKeys(row.evidenceKeys),
  };
}

export function normalizeAiInsightReport(value: unknown): AiInsightReport | null {
  const root = object(value);
  const headline = cleanText(root.headline, 140);
  const summary = cleanText(root.summary, 620);
  if (!headline || !summary) return null;

  const priorities = Array.isArray(root.priorities)
    ? root.priorities
        .map(normalizeItem)
        .filter((item): item is AiInsightItem => item !== null)
        .slice(0, 3)
    : [];
  const opportunities = Array.isArray(root.opportunities)
    ? root.opportunities
        .map(normalizeItem)
        .filter((item): item is AiInsightItem => item !== null)
        .slice(0, 3)
    : [];
  const watchlist = Array.isArray(root.watchlist)
    ? root.watchlist
        .map(normalizeItem)
        .filter((item): item is AiInsightItem => item !== null)
        .slice(0, 3)
    : [];
  const actionPlan = Array.isArray(root.actionPlan)
    ? root.actionPlan
        .map(normalizeAction)
        .filter((item): item is AiActionStep => item !== null)
        .sort((left, right) => left.order - right.order)
        .slice(0, 4)
    : [];

  if (!priorities.length || !actionPlan.length) return null;

  const dataLimitations = Array.isArray(root.dataLimitations)
    ? root.dataLimitations
        .map((entry) => cleanText(entry, 220))
        .filter(Boolean)
        .slice(0, 5)
    : [];

  return {
    schemaVersion: 1,
    headline,
    summary,
    position: validEnum(root.position, POSITIONS, "Not assessed"),
    priorities,
    opportunities,
    watchlist,
    actionPlan,
    dataLimitations,
    disclaimer: cleanText(
      root.disclaimer,
      300,
      "Planning guidance only. This is not individualized investment, tax, legal, or credit advice.",
    ),
  };
}

export function normalizeAiInsightSnapshot(
  value: unknown,
): AiInsightSnapshot | null {
  const row = object(value);
  const report = normalizeAiInsightReport(row.report);
  const id = string(row.id);
  const dataFingerprint = string(
    row.data_fingerprint ?? row.dataFingerprint,
  );
  const generatedAt = string(row.generated_at ?? row.generatedAt);
  if (!id || !dataFingerprint || !generatedAt || !report) return null;

  return {
    id,
    dataFingerprint,
    report,
    model: string(row.model, "AI model"),
    dataCoverage: clamp(
      integer(row.data_coverage ?? row.dataCoverage),
      0,
      100,
    ),
    generatedAt,
  };
}



export const SMART_INSIGHTS_ENGINE_VERSION = "FICONTER Smart Engine v1";

type RankedInsight = AiInsightItem & { rank: number };

function metricNumber(
  context: AiInsightsContext,
  key: AiEvidenceKey,
): number {
  const value = context.evidence[key].value;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function insight(
  rank: number,
  domain: AiInsightDomain,
  priority: AiInsightPriority,
  title: string,
  detail: string,
  action: string,
  evidenceKeys: AiEvidenceKey[],
): RankedInsight {
  return {
    rank,
    domain,
    priority,
    title,
    insight: detail,
    action,
    evidenceKeys: evidenceKeys.slice(0, 4),
  };
}

function withoutRank(item: RankedInsight): AiInsightItem {
  const { rank: _rank, ...result } = item;
  return result;
}

function uniqueInsights(items: RankedInsight[], maximum: number): AiInsightItem[] {
  const seen = new Set<string>();
  return items
    .sort((left, right) => right.rank - left.rank)
    .filter((item) => {
      const key = `${item.domain}:${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maximum)
    .map(withoutRank);
}

function smartPosition(context: AiInsightsContext): AiInsightReport["position"] {
  if (!context.assessed) return "Not assessed";

  const healthScore = metricNumber(context, "financial_health_score");
  const wealthScore = metricNumber(context, "wealth_score");
  const netWorth = metricNumber(context, "net_worth");
  const cashFlowMargin = metricNumber(context, "cash_flow_margin");
  const overdueBills = metricNumber(context, "overdue_bills");

  if (overdueBills > 0 || cashFlowMargin < 0 || healthScore < 40) {
    return "At risk";
  }
  if (healthScore < 60 || netWorth < 0) return "Needs attention";
  if (healthScore >= 75 && wealthScore >= 60 && netWorth > 0) return "Strong";
  if (healthScore >= 60 && cashFlowMargin >= 0) return "Stable";
  return "Building";
}

function headlineFor(position: AiInsightReport["position"]): string {
  switch (position) {
    case "At risk":
      return "Stabilize the financial foundation first";
    case "Needs attention":
      return "Protect cash flow and reduce financial pressure";
    case "Stable":
      return "Turn financial stability into stronger momentum";
    case "Building":
      return "Your financial foundation is taking shape";
    case "Strong":
      return "Your wealth system is gaining strength";
    default:
      return "Build the financial baseline first";
  }
}

/**
 * Creates a deterministic, cost-free report from FICONTER's existing verified
 * Wealth Engine outputs. It never calls an external model and never creates a
 * parallel balance, score, or forecast.
 */
export function generateSmartInsightReport(
  context: AiInsightsContext,
): AiInsightReport {
  const cashFlow = context.sources.cashFlow;
  const financialIndependence = context.sources.financialIndependence;
  const savings = financialIndependence.sources.savings;
  const emergency = financialIndependence.sources.emergency;
  const growth = financialIndependence.sources.growth;
  const health = cashFlow.health;

  const income = health.metrics.totalIncome;
  const cashFlowMargin = metricNumber(context, "cash_flow_margin");
  const currentNetFlow = metricNumber(context, "current_month_net_flow");
  const projectedNetFlow = context.evidence.projected_30_day_net_flow.value;
  const knownCommitments = metricNumber(context, "known_commitments");
  const savingsRate = metricNumber(context, "savings_rate");
  const emergencyMonths = metricNumber(context, "emergency_months");
  const currentDebt = metricNumber(context, "current_debt");
  const debtServiceRatio = metricNumber(context, "debt_service_ratio");
  const overdueBills = metricNumber(context, "overdue_bills");
  const goalProgress = metricNumber(context, "goal_progress");
  const netWorth = metricNumber(context, "net_worth");
  const wealthScore = metricNumber(context, "wealth_score");
  const fiProgress = metricNumber(context, "financial_independence_progress");
  const plannerActive = context.evidence.planner_status.value === "Current-month planner active";

  const priorityCandidates: RankedInsight[] = [];
  const opportunityCandidates: RankedInsight[] = [];
  const watchCandidates: RankedInsight[] = [];

  if (overdueBills > 0) {
    priorityCandidates.push(
      insight(
        100,
        "Bills",
        "critical",
        "Resolve overdue obligations first",
        "Overdue obligations weaken payment reliability and can create avoidable fees or additional pressure.",
        "Review every overdue bill and either settle it or update its payment plan immediately.",
        ["overdue_bills", "known_commitments"],
      ),
    );
  }

  if (income <= 0) {
    priorityCandidates.push(
      insight(
        98,
        "Cash flow",
        "critical",
        "Establish an income baseline",
        "FICONTER cannot assess sustainable cash-flow capacity until income activity is recorded.",
        "Record current income sources before relying on forecasts or contribution targets.",
        ["current_month_net_flow", "cash_flow_margin"],
      ),
    );
  } else if (cashFlowMargin < 0 || currentNetFlow < 0) {
    priorityCandidates.push(
      insight(
        96,
        "Cash flow",
        "critical",
        "Restore positive monthly cash flow",
        "Current outflows are consuming more than the available monthly inflow.",
        "Reduce flexible spending or increase income until monthly net flow becomes positive.",
        ["cash_flow_margin", "current_month_net_flow"],
      ),
    );
  } else if (cashFlowMargin < 10) {
    priorityCandidates.push(
      insight(
        78,
        "Cash flow",
        "high",
        "Create more monthly breathing room",
        "The current margin leaves limited room for unexpected costs and long-term priorities.",
        "Protect a larger share of income before increasing optional commitments.",
        ["cash_flow_margin", "current_month_net_flow"],
      ),
    );
  } else {
    opportunityCandidates.push(
      insight(
        72,
        "Cash flow",
        "low",
        "Protect the positive cash-flow margin",
        "A positive monthly margin creates room for resilience, saving, and debt reduction.",
        "Direct a planned share of the surplus toward the highest-priority financial goal.",
        ["cash_flow_margin", "current_month_net_flow"],
      ),
    );
  }

  if (emergency.metrics.averageMonthlyExpenses > 0 && emergencyMonths < 1) {
    priorityCandidates.push(
      insight(
        90,
        "Emergency fund",
        "high",
        "Build the first emergency buffer",
        "The current reserve does not yet cover one full average month of recorded expenses.",
        "Prioritize the first one-month reserve before increasing lower-priority allocations.",
        ["emergency_reserve", "emergency_months", "emergency_gap"],
      ),
    );
  } else if (emergencyMonths < 3 && emergency.metrics.averageMonthlyExpenses > 0) {
    priorityCandidates.push(
      insight(
        70,
        "Emergency fund",
        "medium",
        "Strengthen financial resilience",
        "The reserve has started but remains below the three-month protection foundation.",
        "Maintain a consistent monthly emergency contribution until the foundation target is reached.",
        ["emergency_months", "emergency_gap"],
      ),
    );
  } else if (emergencyMonths >= 3) {
    opportunityCandidates.push(
      insight(
        64,
        "Emergency fund",
        "low",
        "Preserve the emergency reserve",
        "The recorded reserve now provides a meaningful financial buffer.",
        "Keep the reserve separate and replenish it after any genuine emergency withdrawal.",
        ["emergency_reserve", "emergency_months"],
      ),
    );
  }

  if (currentDebt > 0 && (debtServiceRatio >= 25 || netWorth < 0)) {
    priorityCandidates.push(
      insight(
        debtServiceRatio >= 35 ? 94 : 84,
        "Debt",
        debtServiceRatio >= 35 ? "critical" : "high",
        "Reduce debt pressure deliberately",
        "Debt is limiting financial flexibility and slowing improvement in the long-term wealth position.",
        "Keep minimums current and direct additional capacity toward consistent principal reduction.",
        ["current_debt", "debt_service_ratio", "net_worth"],
      ),
    );
  } else if (currentDebt > 0) {
    watchCandidates.push(
      insight(
        58,
        "Debt",
        "medium",
        "Keep debt reduction visible",
        "Debt remains an active claim on future cash flow even when current payments are manageable.",
        "Review progress monthly and avoid adding new balances while existing debt is being reduced.",
        ["current_debt", "debt_service_ratio"],
      ),
    );
  } else if (health.assessed) {
    opportunityCandidates.push(
      insight(
        55,
        "Debt",
        "low",
        "Preserve borrowing flexibility",
        "No active debt is currently reducing monthly flexibility.",
        "Keep future borrowing deliberate and affordable.",
        ["current_debt", "debt_service_ratio"],
      ),
    );
  }

  if (income > 0 && savingsRate < 5) {
    priorityCandidates.push(
      insight(
        82,
        "Savings",
        "high",
        "Start a repeatable saving habit",
        "The current saving rate is too low to build meaningful long-term momentum.",
        "Begin with a realistic recurring contribution and increase it after consistency is established.",
        ["savings_rate", "monthly_savings_pace", "savings_target_gap"],
      ),
    );
  } else if (income > 0 && savingsRate < 15) {
    priorityCandidates.push(
      insight(
        62,
        "Savings",
        "medium",
        "Raise the saving pace gradually",
        "Savings are being recorded, but the current pace remains below a stronger long-term range.",
        "Close part of the monthly target gap with a sustainable automatic contribution.",
        ["savings_rate", "monthly_savings_pace", "savings_target_gap"],
      ),
    );
  } else if (savingsRate >= 15) {
    opportunityCandidates.push(
      insight(
        68,
        "Savings",
        "low",
        "Maintain the saving momentum",
        "The recorded saving rate is contributing positively to future financial capacity.",
        "Keep contributions consistent and align them with the most important active priorities.",
        ["savings_rate", "monthly_savings_pace"],
      ),
    );
  }

  if (netWorth < 0) {
    priorityCandidates.push(
      insight(
        76,
        "Net worth",
        "high",
        "Move net worth toward positive territory",
        "Liabilities currently exceed recorded capital, which limits the long-term wealth position.",
        "Combine retained cash flow with principal debt reduction and avoid counting savings twice.",
        ["net_worth", "capital_to_debt_ratio", "current_debt"],
      ),
    );
  } else if (netWorth > 0 && wealthScore >= 60) {
    opportunityCandidates.push(
      insight(
        66,
        "Net worth",
        "low",
        "Build on the positive wealth position",
        "Recorded capital is supporting a stronger long-term position relative to liabilities.",
        "Continue adding capital while protecting the current debt and cash-flow discipline.",
        ["net_worth", "wealth_score", "capital_to_debt_ratio"],
      ),
    );
  }

  if (goalProgress <= 0 && health.assessed) {
    watchCandidates.push(
      insight(
        46,
        "Goals",
        "low",
        "Connect cash flow to a measurable goal",
        "No funded goal progress is currently visible in the financial system.",
        "Choose one measurable priority and record contributions consistently.",
        ["goal_progress", "current_month_net_flow"],
      ),
    );
  } else if (goalProgress > 0) {
    opportunityCandidates.push(
      insight(
        48,
        "Goals",
        "low",
        "Keep goal funding aligned",
        "Recorded goal progress is connecting current cash flow with a future outcome.",
        "Review the target date and contribution pace whenever financial capacity changes.",
        ["goal_progress", "monthly_savings_pace"],
      ),
    );
  }

  if (!plannerActive) {
    watchCandidates.push(
      insight(
        44,
        "Planning",
        "low",
        "Activate the monthly planner",
        "A current-month plan is not available to compare intended and actual financial activity.",
        "Create a simple monthly plan for income, bills, saving, goals, and debt.",
        ["planner_status", "known_commitments"],
      ),
    );
  }

  if (!cashFlow.forecastAvailable) {
    watchCandidates.push(
      insight(
        60,
        "Cash flow",
        "medium",
        "Forecast confidence is still developing",
        "There is not yet enough completed history for a reliable 30-day cash-flow outlook.",
        "Keep income and outflow records current until the forecast activates.",
        ["projected_30_day_net_flow", "cash_flow_margin"],
      ),
    );
  } else if (typeof projectedNetFlow === "number" && projectedNetFlow < 0) {
    priorityCandidates.push(
      insight(
        88,
        "Cash flow",
        "high",
        "Prepare for a negative 30-day outlook",
        "The verified short-term projection indicates that known outflows may exceed expected inflows.",
        "Review upcoming commitments and reduce avoidable outflow before the projected pressure arrives.",
        ["projected_30_day_net_flow", "known_commitments"],
      ),
    );
  }

  if (!growth.hasHistory) {
    watchCandidates.push(
      insight(
        52,
        "Net worth",
        "medium",
        "Net-worth trend needs more history",
        "FICONTER cannot yet distinguish a durable growth trend from the opening financial baseline.",
        "Maintain complete monthly records until several genuine month-to-month changes exist.",
        ["six_month_net_worth_change", "net_worth"],
      ),
    );
  }

  if (knownCommitments > 0 && cashFlowMargin < 20) {
    watchCandidates.push(
      insight(
        54,
        "Bills",
        "medium",
        "Keep fixed commitments funded",
        "Known near-term obligations consume part of the available monthly capacity.",
        "Reserve the required amount before allocating discretionary spending.",
        ["known_commitments", "cash_flow_margin"],
      ),
    );
  }

  if (fiProgress > 0) {
    opportunityCandidates.push(
      insight(
        45,
        "Financial independence",
        "low",
        "Make independence progress repeatable",
        "Current investable capital is already supporting part of the long-term lifestyle target.",
        "Protect a consistent wealth contribution and review planning assumptions annually.",
        [
          "financial_independence_progress",
          "monthly_freedom_income",
          "financial_independence_target",
        ],
      ),
    );
  }

  if (context.dataCoverage < 50) {
    watchCandidates.push(
      insight(
        72,
        "Planning",
        "medium",
        "Improve data coverage before relying on long-term conclusions",
        "Several Wealth Engine modules are still working with limited financial history.",
        "Keep records complete and review the report again after more monthly activity is available.",
        ["planner_status", "financial_health_score", "wealth_score"],
      ),
    );
  }

  let priorities = uniqueInsights(priorityCandidates, 3);
  if (!priorities.length) {
    priorities = [
      {
        domain: "Financial health",
        priority: "low",
        title: "Keep the financial system current",
        insight:
          "No urgent weakness was identified from the currently verified FICONTER signals.",
        action:
          "Continue recording activity and review the main scores after each completed month.",
        evidenceKeys: ["financial_health_score", "wealth_score"],
      },
    ];
  }

  const opportunities = uniqueInsights(opportunityCandidates, 3);
  const watchlist = uniqueInsights(watchCandidates, 3);
  const position = smartPosition(context);
  const headline = headlineFor(position);
  const lead = priorities[0];
  const opportunityLead = opportunities[0];
  const summary = opportunityLead
    ? `${lead.title} is the clearest current priority. ${opportunityLead.title} is the strongest verified opportunity to build on.`
    : `${lead.title} is the clearest current priority. Continue building complete monthly records so FICONTER can strengthen the analysis.`;

  const actionSources = [
    ...priorities,
    ...opportunities,
    ...watchlist,
  ].filter(
    (item, index, items) =>
      items.findIndex(
        (candidate) =>
          candidate.domain === item.domain && candidate.title === item.title,
      ) === index,
  );

  const horizons: AiActionStep["horizon"][] = [
    "This week",
    "This month",
    "Next 90 days",
    "Ongoing",
  ];
  const actionPlan: AiActionStep[] = actionSources.slice(0, 4).map((item, index) => ({
    order: index + 1,
    horizon: horizons[index] ?? "Ongoing",
    title: item.title,
    action: item.action,
    evidenceKeys: item.evidenceKeys,
  }));

  const fallbackSteps: Omit<AiActionStep, "order">[] = [
    {
      horizon: "This month",
      title: "Review the monthly plan",
      action:
        "Compare planned income and commitments with actual activity before making new discretionary allocations.",
      evidenceKeys: ["planner_status", "known_commitments"],
    },
    {
      horizon: "Next 90 days",
      title: "Build one measurable improvement",
      action:
        "Choose one priority—cash flow, reserve, saving, or debt—and track the same action for three completed months.",
      evidenceKeys: ["financial_health_score", "wealth_score"],
    },
    {
      horizon: "Ongoing",
      title: "Keep FICONTER records current",
      action:
        "Record income, outflows, saving contributions, bills, debt payments, and goal activity as they happen.",
      evidenceKeys: ["planner_status", "financial_health_score"],
    },
  ];

  for (const fallback of fallbackSteps) {
    if (actionPlan.length >= 4) break;
    if (actionPlan.some((step) => step.title === fallback.title)) continue;
    actionPlan.push({ order: actionPlan.length + 1, ...fallback });
  }

  const dataLimitations: string[] = [];
  if (context.dataCoverage < 50) {
    dataLimitations.push(
      "The report is based on developing data coverage, so priorities may change as more complete monthly history is recorded.",
    );
  }
  if (!cashFlow.forecastAvailable) {
    dataLimitations.push(
      "The 30-day cash-flow forecast is unavailable until enough income and outflow history exists.",
    );
  }
  if (!growth.hasHistory) {
    dataLimitations.push(
      "Net-worth growth cannot be assessed reliably until genuine month-to-month history is available.",
    );
  }
  if (!savings.hasSavingsData) {
    dataLimitations.push(
      "Savings consistency and allocation cannot be assessed until non-emergency saving contributions are recorded.",
    );
  }
  if (emergency.metrics.averageMonthlyExpenses <= 0) {
    dataLimitations.push(
      "Emergency-fund coverage requires an established average monthly expense baseline.",
    );
  }

  return {
    schemaVersion: 1,
    headline,
    summary,
    position,
    priorities,
    opportunities,
    watchlist,
    actionPlan: actionPlan.slice(0, 4),
    dataLimitations: dataLimitations.slice(0, 5),
    disclaimer:
      "Planning guidance generated from FICONTER's verified rules and recorded data. It is not individualized investment, tax, legal, or credit advice.",
  };
}

export const AI_INSIGHT_EVIDENCE_KEYS = EVIDENCE_KEYS;
export const AI_INSIGHT_DOMAINS = DOMAINS;
export const AI_INSIGHT_PRIORITIES = PRIORITIES;
export const AI_INSIGHT_POSITIONS = POSITIONS;
export const AI_INSIGHT_HORIZONS = HORIZONS;
