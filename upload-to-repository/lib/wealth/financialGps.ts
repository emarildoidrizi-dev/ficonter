import {
  calculateAiInsightsContext,
  generateSmartInsightReport,
  type AiEvidenceKey,
  type AiInsightDomain,
  type AiInsightsInputs,
} from "@/lib/wealth/aiInsights";
import {
  calculateFinancialSetup,
  type SetupAcknowledgements,
} from "@/lib/wealth/setupReadiness";

export type FinancialGpsStageId =
  | "setup"
  | "stabilize"
  | "protect"
  | "build"
  | "grow"
  | "freedom";

export type FinancialGpsTone =
  | "neutral"
  | "info"
  | "positive"
  | "warning"
  | "critical";

export type FinancialGpsStage = {
  id: FinancialGpsStageId;
  label: string;
  description: string;
};

export type FinancialGpsEvidence = {
  label: string;
  value: number | string | null;
  format: "currency" | "percent" | "ratio" | "months" | "score" | "status" | "number";
};

export type FinancialGpsAction = {
  id: string;
  title: string;
  explanation: string;
  instruction: string;
  href: string;
  ctaLabel: string;
  domain: AiInsightDomain | "Setup";
  tone: FinancialGpsTone;
  evidence: FinancialGpsEvidence[];
};

export type FinancialGpsMetric = {
  id: "cash-flow" | "emergency" | "debt" | "savings";
  label: string;
  value: number | null;
  format: "currency" | "percent" | "months";
  caption: string;
  tone: FinancialGpsTone;
};

export type FinancialGpsResult = {
  active: boolean;
  generatedAt: string;
  stage: FinancialGpsStage;
  stageIndex: number;
  stages: FinancialGpsStage[];
  positionLabel: string;
  headline: string;
  summary: string;
  confidenceLabel: string;
  coverage: number;
  setupCompletion: number;
  primaryAction: FinancialGpsAction;
  actionPath: FinancialGpsAction[];
  metrics: FinancialGpsMetric[];
  milestone: string;
  notice: string | null;
};

export const FINANCIAL_GPS_STAGES: FinancialGpsStage[] = [
  {
    id: "setup",
    label: "Set up",
    description: "Create a trustworthy financial baseline.",
  },
  {
    id: "stabilize",
    label: "Stabilize",
    description: "Cover immediate obligations and restore positive cash flow.",
  },
  {
    id: "protect",
    label: "Protect",
    description: "Reduce pressure and build the first financial buffer.",
  },
  {
    id: "build",
    label: "Build",
    description: "Strengthen savings, goals, and financial resilience.",
  },
  {
    id: "grow",
    label: "Grow",
    description: "Turn consistent surplus into long-term progress.",
  },
  {
    id: "freedom",
    label: "Freedom",
    description: "Protect and sustain financial independence.",
  },
];

const DOMAIN_ROUTES: Record<AiInsightDomain, string> = {
  "Financial health": "/dashboard",
  "Cash flow": "/dashboard/cash-flow",
  Savings: "/dashboard/savings",
  "Emergency fund": "/dashboard/emergency-fund",
  Debt: "/dashboard/debt",
  Bills: "/dashboard/bills",
  Goals: "/dashboard/goals",
  "Net worth": "/dashboard/net-worth",
  "Financial independence": "/dashboard/financial-independence",
  Planning: "/dashboard/budget",
};

const DOMAIN_CTA: Record<AiInsightDomain, string> = {
  "Financial health": "Open overview",
  "Cash flow": "Review cash flow",
  Savings: "Open savings",
  "Emergency fund": "Open emergency fund",
  Debt: "Review debt",
  Bills: "Review bills",
  Goals: "Open goals",
  "Net worth": "Open net worth",
  "Financial independence": "View independence plan",
  Planning: "Open monthly planner",
};

function metricNumber(
  value: number | string | null,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toneFromPriority(priority: string): FinancialGpsTone {
  if (priority === "critical") return "critical";
  if (priority === "high") return "warning";
  if (priority === "low") return "positive";
  return "info";
}

function evidenceFor(
  inputs: ReturnType<typeof calculateAiInsightsContext>,
  keys: AiEvidenceKey[],
): FinancialGpsEvidence[] {
  return keys.slice(0, 3).map((key) => {
    const metric = inputs.evidence[key];
    return {
      label: metric.label,
      value: metric.value,
      format: metric.format,
    };
  });
}

function domainForEvidence(
  context: ReturnType<typeof calculateAiInsightsContext>,
  evidenceKeys: AiEvidenceKey[],
): AiInsightDomain {
  const key = evidenceKeys.find((item) => context.evidence[item]);
  return key ? context.evidence[key].domain : "Financial health";
}

function setupAction(
  step: ReturnType<typeof calculateFinancialSetup>["steps"][number],
  order: number,
): FinancialGpsAction {
  return {
    id: `setup-${step.id}-${order}`,
    title: step.title,
    explanation: step.description,
    instruction: `Complete this step so FICONTER can make its guidance more accurate.`,
    href: step.href,
    ctaLabel: "Complete this step",
    domain: "Setup",
    tone: order === 0 ? "warning" : "neutral",
    evidence: [],
  };
}

function stageFor(input: {
  setupReady: boolean;
  overdueBills: number;
  currentNetFlow: number;
  healthScore: number;
  emergencyMonths: number;
  debtServiceRatio: number;
  savingsRate: number;
  wealthScore: number;
  financialIndependenceProgress: number;
}): FinancialGpsStageId {
  if (!input.setupReady) return "setup";

  if (
    input.overdueBills > 0 ||
    input.currentNetFlow < 0 ||
    input.healthScore < 40
  ) {
    return "stabilize";
  }

  if (input.emergencyMonths < 1 || input.debtServiceRatio >= 25) {
    return "protect";
  }

  if (
    input.emergencyMonths < 3 ||
    input.savingsRate < 10 ||
    input.wealthScore < 55
  ) {
    return "build";
  }

  if (input.financialIndependenceProgress < 100) return "grow";
  return "freedom";
}

function milestoneFor(stage: FinancialGpsStageId): string {
  switch (stage) {
    case "setup":
      return "Complete the financial baseline";
    case "stabilize":
      return "Restore a dependable monthly position";
    case "protect":
      return "Build one month of financial protection";
    case "build":
      return "Build a three-month resilience foundation";
    case "grow":
      return "Create repeatable long-term wealth progress";
    case "freedom":
      return "Protect the independence you have built";
  }
}

function positionFor(
  stage: FinancialGpsStageId,
  profileComplete: boolean,
): string {
  if (!profileComplete && stage !== "setup") return "Early guidance";
  switch (stage) {
    case "setup":
      return "Setup in progress";
    case "stabilize":
      return "Immediate focus";
    case "protect":
      return "Building protection";
    case "build":
      return "Building momentum";
    case "grow":
      return "Growing steadily";
    case "freedom":
      return "Financial freedom";
  }
}

function headlineFor(stage: FinancialGpsStageId): string {
  switch (stage) {
    case "setup":
      return "Finish your baseline before relying on conclusions";
    case "stabilize":
      return "Focus on financial breathing room first";
    case "protect":
      return "Protect the progress you are beginning to make";
    case "build":
      return "Turn stability into a stronger financial foundation";
    case "grow":
      return "Use your positive capacity with clear purpose";
    case "freedom":
      return "Maintain strength without losing flexibility";
  }
}

function metricTone(
  kind: FinancialGpsMetric["id"],
  value: number | null,
): FinancialGpsTone {
  if (value === null) return "neutral";
  if (kind === "cash-flow") {
    if (value < 0) return "critical";
    if (value === 0) return "warning";
    return "positive";
  }
  if (kind === "emergency") {
    if (value < 1) return "warning";
    if (value >= 3) return "positive";
    return "info";
  }
  if (kind === "debt") return value > 0 ? "info" : "positive";
  if (value < 5) return "warning";
  if (value >= 15) return "positive";
  return "info";
}

export function calculateFinancialGps(
  rawInputs: AiInsightsInputs,
  acknowledgements: SetupAcknowledgements,
): FinancialGpsResult {
  const context = calculateAiInsightsContext(rawInputs);
  const setup = calculateFinancialSetup(
    rawInputs.cashFlow.financialHealth,
    acknowledgements,
  );
  const report = context.assessed ? generateSmartInsightReport(context) : null;

  const currentNetFlow = metricNumber(
    context.evidence.current_month_net_flow.value,
  );
  const emergencyMonths = metricNumber(
    context.evidence.emergency_months.value,
  );
  const currentDebt = metricNumber(context.evidence.current_debt.value);
  const savingsRate = metricNumber(context.evidence.savings_rate.value);
  const healthScore = metricNumber(
    context.evidence.financial_health_score.value,
  );
  const wealthScore = metricNumber(context.evidence.wealth_score.value);
  const overdueBills = metricNumber(context.evidence.overdue_bills.value);
  const debtServiceRatio = metricNumber(
    context.evidence.debt_service_ratio.value,
  );
  const financialIndependenceProgress = metricNumber(
    context.evidence.financial_independence_progress.value,
  );

  const stageId = stageFor({
    setupReady: setup.scoreReady,
    overdueBills,
    currentNetFlow,
    healthScore,
    emergencyMonths,
    debtServiceRatio,
    savingsRate,
    wealthScore,
    financialIndependenceProgress,
  });
  const stageIndex = FINANCIAL_GPS_STAGES.findIndex(
    (stage) => stage.id === stageId,
  );
  const stage = FINANCIAL_GPS_STAGES[stageIndex] ?? FINANCIAL_GPS_STAGES[0];

  const incompleteSteps = setup.steps.filter((step) => !step.completed);
  let primaryAction: FinancialGpsAction;
  let actionPath: FinancialGpsAction[];

  if (!setup.scoreReady && incompleteSteps.length) {
    actionPath = incompleteSteps.slice(0, 3).map(setupAction);
    primaryAction = actionPath[0];
  } else if (report) {
    const priority = report.priorities[0];
    const domain = priority?.domain ?? "Financial health";
    primaryAction = priority
      ? {
          id: `priority-${domain}-${priority.title}`,
          title: priority.title,
          explanation: priority.insight,
          instruction: priority.action,
          href: DOMAIN_ROUTES[domain],
          ctaLabel: DOMAIN_CTA[domain],
          domain,
          tone: toneFromPriority(priority.priority),
          evidence: evidenceFor(context, priority.evidenceKeys),
        }
      : {
          id: "review-overview",
          title: "Keep your financial records current",
          explanation:
            "Your current position is stable enough for regular review rather than urgent correction.",
          instruction:
            "Review this month’s income, outflows, and planned commitments before making a new allocation.",
          href: "/dashboard",
          ctaLabel: "Review overview",
          domain: "Financial health",
          tone: "positive",
          evidence: [],
        };

    const seen = new Set<string>([primaryAction.href]);
    actionPath = [primaryAction];

    for (const step of report.actionPlan) {
      const domainForStep = domainForEvidence(context, step.evidenceKeys);
      const href = DOMAIN_ROUTES[domainForStep];
      if (seen.has(href)) continue;
      seen.add(href);
      actionPath.push({
        id: `path-${step.order}-${step.title}`,
        title: step.title,
        explanation: step.action,
        instruction: step.action,
        href,
        ctaLabel: DOMAIN_CTA[domainForStep],
        domain: domainForStep,
        tone: step.order === 1 ? "warning" : "neutral",
        evidence: evidenceFor(context, step.evidenceKeys),
      });
      if (actionPath.length >= 3) break;
    }

    if (!setup.profileComplete) {
      const nextSetup = incompleteSteps[0];
      if (nextSetup && actionPath.length < 3) {
        actionPath.push(setupAction(nextSetup, actionPath.length));
      }
    }
  } else {
    const fallback = setup.steps[0];
    primaryAction = setupAction(fallback, 0);
    actionPath = [primaryAction];
  }

  const cashFlowAvailable = setup.scoreReady;
  const emergencyAvailable =
    rawInputs.financialIndependence.emergencyFund.monthly.length > 0 ||
    rawInputs.cashFlow.financialHealth.transactions.totalExpenses > 0;
  const debtAvailable =
    rawInputs.cashFlow.financialHealth.debts.count > 0 || acknowledgements.debtFree;
  const savingsAvailable = setup.scoreReady;

  const metrics: FinancialGpsMetric[] = [
    {
      id: "cash-flow",
      label: "Current-month net flow",
      value: cashFlowAvailable ? currentNetFlow : null,
      format: "currency",
      caption: cashFlowAvailable
        ? "Income minus all recorded outflows in the current calendar month"
        : "Add income and an outflow to activate",
      tone: metricTone("cash-flow", cashFlowAvailable ? currentNetFlow : null),
    },
    {
      id: "emergency",
      label: "Emergency coverage",
      value: emergencyAvailable ? emergencyMonths : null,
      format: "months",
      caption: emergencyAvailable
        ? "Months covered by the monthly protection baseline"
        : "Expense baseline required",
      tone: metricTone("emergency", emergencyAvailable ? emergencyMonths : null),
    },
    {
      id: "debt",
      label: "Current debt",
      value: debtAvailable ? currentDebt : null,
      format: "currency",
      caption: acknowledgements.debtFree && currentDebt <= 0
        ? "Confirmed debt-free"
        : debtAvailable
          ? "Active recorded liabilities"
          : "Debt position not confirmed",
      tone: metricTone("debt", debtAvailable ? currentDebt : null),
    },
    {
      id: "savings",
      label: "Non-emergency savings rate",
      value: savingsAvailable ? savingsRate : null,
      format: "percent",
      caption: savingsAvailable
        ? "Non-emergency savings as a share of recorded income"
        : "Outflow baseline required",
      tone: metricTone("savings", savingsAvailable ? savingsRate : null),
    },
  ];

  const summary = !setup.scoreReady
    ? "FICONTER needs a real income and outflow baseline before it can rank financial priorities safely. Complete the next setup step and the guidance will update automatically."
    : report?.summary ??
      "Your Financial GPS is using the information already recorded across FICONTER to rank the next useful action.";

  return {
    active: setup.scoreReady,
    generatedAt: rawInputs.generatedAt,
    stage,
    stageIndex,
    stages: FINANCIAL_GPS_STAGES,
    positionLabel: positionFor(stage.id, setup.profileComplete),
    headline: headlineFor(stage.id),
    summary,
    confidenceLabel: setup.profileComplete
      ? `${context.confidence} confidence`
      : setup.scoreReady
        ? "Preliminary guidance"
        : "Waiting for baseline",
    coverage: context.dataCoverage,
    setupCompletion: setup.completionPercentage,
    primaryAction,
    actionPath: actionPath.slice(0, 3),
    metrics,
    milestone: milestoneFor(stage.id),
    notice: !setup.profileComplete
      ? `${setup.completedCount} of ${setup.totalCount} financial setup areas are complete. Guidance will become more precise as the remaining areas are confirmed.`
      : context.dataCoverage < 50
        ? "Guidance is active, but longer financial history will improve confidence."
        : null,
  };
}
