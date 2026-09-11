import {
  calculateAiInsightsContext,
  generateSmartInsightReport,
  type AiEvidenceFormat,
  type AiInsightsInputs,
} from "@/lib/wealth/aiInsights";

export type AskFiconterIntent =
  | "purchase_timeline"
  | "affordability"
  | "monthly_commitment"
  | "lease_or_buy"
  | "debt_vs_savings"
  | "savings_timeline"
  | "spending_capacity"
  | "financial_health"
  | "priority"
  | "general";

export type AskFiconterTone = "positive" | "info" | "warning" | "critical";

export type AskFiconterEvidence = {
  key: string;
  label: string;
  value: number | string | null;
  format: AiEvidenceFormat;
  note?: string;
};

export type AskFiconterScenario = {
  label: string;
  headline: string;
  detail: string;
};

export type AskFiconterAnswer = {
  intent: AskFiconterIntent;
  title: string;
  verdict: string;
  summary: string;
  detail: string;
  tone: AskFiconterTone;
  confidence: string;
  dataCoverage: number;
  evidence: AskFiconterEvidence[];
  scenarios: AskFiconterScenario[];
  followUps: string[];
  disclaimer: string;
};

const DISCLAIMER =
  "FICONTER provides planning guidance from the financial data you record. It is not regulated investment, tax, legal, insurance, or credit advice.";

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(roundMoney(value));
  } catch {
    return `${roundMoney(value).toLocaleString("en-GB")} ${currency}`;
  }
}

function parseNumericToken(raw: string): number | null {
  let token = raw.replace(/[\s']/g, "").trim();
  if (!token) return null;

  const lastComma = token.lastIndexOf(",");
  const lastDot = token.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    token = token.split(thousands).join("");
    if (decimal === ",") token = token.replace(",", ".");
  } else if (lastComma >= 0 || lastDot >= 0) {
    const separator = lastComma >= 0 ? "," : ".";
    const pieces = token.split(separator);
    if (pieces.length > 2 || (pieces.length === 2 && pieces[1]?.length === 3)) {
      token = pieces.join("");
    } else if (separator === ",") {
      token = token.replace(",", ".");
    }
  }

  const parsed = Number(token);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function amountFromQuestion(question: string): number | null {
  const explicit = question.match(
    /(?:€|£|\$|\b(?:eur|usd|gbp|chf|all|lek)\b)\s*([0-9][0-9\s.,']*)|([0-9][0-9\s.,']*)\s*(?:€|£|\$|\b(?:eur|usd|gbp|chf|all|lek)\b)/i,
  );
  const explicitToken = explicit?.[1] ?? explicit?.[2];
  if (explicitToken) return parseNumericToken(explicitToken);

  const candidates = Array.from(question.matchAll(/[0-9][0-9.,']*/g))
    .map((match) => parseNumericToken(match[0]))
    .filter((value): value is number => value !== null)
    .filter((value) => value > 99 && !(value >= 1900 && value <= 2100));

  return candidates.length ? Math.max(...candidates) : null;
}

function questionCurrency(question: string): string | null {
  const lower = question.toLowerCase();
  if (question.includes("€") || /\beur\b/.test(lower)) return "EUR";
  if (question.includes("£") || /\bgbp\b/.test(lower)) return "GBP";
  if (question.includes("$") || /\busd\b/.test(lower)) return "USD";
  if (/\bchf\b/.test(lower)) return "CHF";
  if (/\b(?:all|lek)\b/.test(lower)) return "ALL";
  return null;
}

function subjectFromQuestion(question: string): string {
  const lower = question.toLowerCase();
  if (/\b(car|vehicle|auto)\b/.test(lower)) return "car";
  if (/\b(home|house|apartment|property)\b/.test(lower)) return "property";
  if (/\b(holiday|vacation|trip|travel)\b/.test(lower)) return "trip";
  if (/\b(phone|laptop|computer)\b/.test(lower)) return "purchase";
  return "purchase";
}

function detectIntent(question: string): AskFiconterIntent {
  const lower = question.toLowerCase();
  const hasBuy = /\b(buy|purchase|finance|financing)\b/.test(lower);
  const hasLease = /\b(lease|leasing)\b/.test(lower);
  const monthly = /\b(monthly|per month|a month|\/month)\b/.test(lower);

  if (hasLease && hasBuy) return "lease_or_buy";
  if (/financial health|health score|why.*score/.test(lower)) return "financial_health";
  if (/what should i|what do i improve|priority|focus on|next step/.test(lower)) return "priority";
  if (/\bdebt\b/.test(lower) && /\b(save|saving|savings)\b/.test(lower)) return "debt_vs_savings";
  if (monthly && /\b(afford|payment|commit|lease|finance)\b/.test(lower)) return "monthly_commitment";
  if (/\bwhen\b/.test(lower) && /\b(afford|buy|purchase|finance)\b/.test(lower)) return "purchase_timeline";
  if (/how long/.test(lower) && /\b(save|saving|reach|goal)\b/.test(lower)) return "savings_timeline";
  if (/how much/.test(lower) && /\b(afford|spend|payment|commit)\b/.test(lower)) return "spending_capacity";
  if (/\b(can i afford|affordable|should i buy|should i purchase)\b/.test(lower)) return "affordability";
  return "general";
}

function addMonthsLabel(months: number): string {
  if (!Number.isFinite(months) || months <= 0) return "now";
  const date = new Date();
  date.setMonth(date.getMonth() + Math.ceil(months));
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function commonEvidence(metrics: {
  averageIncome: number;
  averageOutflow: number;
  averageNet: number;
  projectedNet: number | null;
  safeRecurringCapacity: number;
  emergencyMonths: number;
  currentDebt: number;
  debtServiceRatio: number;
}): AskFiconterEvidence[] {
  return [
    {
      key: "average-income",
      label: "Average monthly income",
      value: metrics.averageIncome,
      format: "currency",
    },
    {
      key: "average-outflow",
      label: "Average monthly outflow",
      value: metrics.averageOutflow,
      format: "currency",
    },
    {
      key: "average-net",
      label: "Average monthly net flow",
      value: metrics.averageNet,
      format: "currency",
    },
    {
      key: "projected-net",
      label: "Projected one-month net flow",
      value: metrics.projectedNet,
      format: "currency",
    },
    {
      key: "safe-capacity",
      label: "Conservative recurring capacity",
      value: metrics.safeRecurringCapacity,
      format: "currency",
      note: "FICONTER keeps part of positive free cash flow uncommitted as a planning buffer.",
    },
    {
      key: "emergency-months",
      label: "Emergency coverage",
      value: metrics.emergencyMonths,
      format: "months",
    },
    {
      key: "debt-service",
      label: "Debt payment-to-income ratio",
      value: metrics.debtServiceRatio,
      format: "percent",
    },
    {
      key: "current-debt",
      label: "Current debt",
      value: metrics.currentDebt,
      format: "currency",
    },
  ];
}

export function askFiconter(
  question: string,
  inputs: AiInsightsInputs,
  currency = "EUR",
): AskFiconterAnswer {
  const cleanQuestion = question.trim();
  const intent = detectIntent(cleanQuestion);
  const amount = amountFromQuestion(cleanQuestion);
  const detectedCurrency = questionCurrency(cleanQuestion);
  const context = calculateAiInsightsContext(inputs);
  const cash = context.sources.cashFlow;
  const independence = context.sources.financialIndependence;
  const savings = independence.sources.savings;
  const emergency = independence.sources.emergency;
  const health = cash.health;
  const report = context.assessed ? generateSmartInsightReport(context) : null;

  const averageIncome = Math.max(0, cash.metrics.averageMonthlyIncome);
  const averageOutflow = Math.max(0, cash.metrics.averageMonthlyOutflow);
  const averageNet = cash.metrics.averageMonthlyNetCashFlow;
  const projectedNet = cash.forecastAvailable
    ? cash.metrics.projectedNetCashFlow
    : null;
  const currentNet = cash.metrics.currentMonthNetCashFlow;
  const emergencyMonths = Math.max(0, emergency.metrics.coverageMonths);
  const emergencyGap = Math.max(0, emergency.metrics.recommendedGap);
  const currentDebt = Math.max(0, health.metrics.currentDebt);
  const debtServiceRatio = Math.max(0, health.metrics.debtServiceRatio * 100);
  const overdueBills = Math.max(0, health.metrics.overdueBills);
  const savingsPace = Math.max(0, savings.metrics.baselineMonthlySavings);
  const totalRecordedSavings = Math.max(0, savings.metrics.totalSaved);

  const surplusCandidates = [averageNet];
  if (projectedNet !== null) surplusCandidates.push(projectedNet);
  if (cash.metrics.leftAfterPayments !== 0) {
    surplusCandidates.push(cash.metrics.leftAfterPayments);
  }
  const dependableSurplus = Math.max(0, Math.min(...surplusCandidates));

  let allocationFactor = 0.6;
  if (emergencyMonths < 3) allocationFactor = 0.45;
  if (emergencyMonths < 1) allocationFactor = 0.3;
  if (debtServiceRatio >= 25) allocationFactor = Math.min(allocationFactor, 0.4);
  if (debtServiceRatio >= 35) allocationFactor = Math.min(allocationFactor, 0.25);
  if (overdueBills > 0 || averageNet <= 0 || currentNet < 0) allocationFactor = 0;

  const safeRecurringCapacity = roundMoney(dependableSurplus * allocationFactor);
  const targetMonthlyCapacity = roundMoney(
    Math.max(savingsPace, safeRecurringCapacity),
  );
  const subject = subjectFromQuestion(cleanQuestion);
  const confidence = `${context.confidence} · ${context.dataCoverage}% data coverage`;
  const evidence = commonEvidence({
    averageIncome,
    averageOutflow,
    averageNet,
    projectedNet,
    safeRecurringCapacity,
    emergencyMonths,
    currentDebt,
    debtServiceRatio,
  });

  if (!context.assessed || averageIncome <= 0) {
    return {
      intent,
      title: "More financial history is needed",
      verdict: "Not enough verified data yet",
      summary:
        "FICONTER cannot make a reliable affordability decision until income and outflow data create a usable financial baseline.",
      detail:
        "Add or confirm income, spending, bills, debt and savings information. FICONTER will then recalculate this answer from the updated vault data.",
      tone: "warning",
      confidence,
      dataCoverage: context.dataCoverage,
      evidence: evidence.slice(0, 3),
      scenarios: [],
      followUps: [
        "What information is missing from my financial profile?",
        "What should I complete first?",
      ],
      disclaimer: DISCLAIMER,
    };
  }

  if (detectedCurrency && detectedCurrency !== currency.toUpperCase() && amount !== null) {
    return {
      intent,
      title: "Confirm the purchase currency",
      verdict: `Your FICONTER base currency is ${currency.toUpperCase()}`,
      summary: `The question contains ${detectedCurrency}, so FICONTER will not silently treat that amount as ${currency.toUpperCase()}.`,
      detail:
        "Use the amount in your current FICONTER base currency for an exact calculation. This prevents an affordability answer from being distorted by an assumed exchange rate.",
      tone: "info",
      confidence,
      dataCoverage: context.dataCoverage,
      evidence: evidence.slice(0, 5),
      scenarios: [],
      followUps: [`Ask again using ${currency.toUpperCase()}`],
      disclaimer: DISCLAIMER,
    };
  }

  if (intent === "lease_or_buy") {
    const protectedFirst =
      emergencyMonths < 3 || overdueBills > 0 || averageNet <= 0 || currentNet < 0;
    const verdict = protectedFirst
      ? "Wait before taking on either commitment"
      : "FICONTER needs both offers before choosing between them";
    const summary = protectedFirst
      ? "Your current protection or cash-flow position does not support adding a new vehicle commitment under FICONTER’s conservative guardrails."
      : `Your current conservative capacity for a new recurring commitment is about ${formatMoney(safeRecurringCapacity, currency)} per month.`;

    return {
      intent,
      title: "Buy or lease?",
      verdict,
      summary,
      detail:
        "For an exact comparison, enter the purchase price, down payment, finance payment and term, plus the lease upfront amount, monthly payment and term. FICONTER will compare cash-flow pressure without pretending that a lower monthly payment automatically means a lower total cost.",
      tone: protectedFirst ? "warning" : "info",
      confidence,
      dataCoverage: context.dataCoverage,
      evidence,
      scenarios: [
        {
          label: "Buy",
          headline: "Better for ownership only if liquidity remains protected",
          detail:
            "Buying becomes stronger when the down payment does not consume the emergency reserve and the resulting monthly ownership cost remains inside conservative recurring capacity.",
        },
        {
          label: "Lease",
          headline: "Better for near-term cash flow only if the full lease cost fits",
          detail:
            "Leasing can preserve upfront cash, but FICONTER still treats the upfront payment, monthly payment and contract term as commitments rather than looking only at the advertised monthly figure.",
        },
      ],
      followUps: [
        "Compare a purchase price and lease offer",
        `Can I afford ${formatMoney(Math.max(100, safeRecurringCapacity), currency)} per month?`,
      ],
      disclaimer: DISCLAIMER,
    };
  }

  if (intent === "monthly_commitment" || (intent === "affordability" && /monthly|per month|a month|\/month/i.test(cleanQuestion))) {
    if (amount === null) {
      return {
        intent: "monthly_commitment",
        title: "Monthly commitment capacity",
        verdict: `${formatMoney(safeRecurringCapacity, currency)} per month is the current conservative ceiling`,
        summary:
          "This is not a lending limit. It is FICONTER’s planning ceiling after keeping part of dependable positive cash flow uncommitted.",
        detail:
          "Give FICONTER the proposed monthly payment and it will compare that payment with your current capacity, protection level and debt pressure.",
        tone: safeRecurringCapacity > 0 ? "info" : "warning",
        confidence,
        dataCoverage: context.dataCoverage,
        evidence,
        scenarios: [],
        followUps: ["Can I afford a 350 monthly payment?"],
        disclaimer: DISCLAIMER,
      };
    }

    const fits = amount <= safeRecurringCapacity && safeRecurringCapacity > 0;
    const remaining = roundMoney(safeRecurringCapacity - amount);
    return {
      intent: "monthly_commitment",
      title: "Monthly payment check",
      verdict: fits ? "Fits the current conservative capacity" : "Above the current conservative capacity",
      summary: fits
        ? `${formatMoney(amount, currency)} per month is within the current FICONTER planning ceiling and leaves about ${formatMoney(Math.max(0, remaining), currency)} of that ceiling unused.`
        : `${formatMoney(amount, currency)} per month is about ${formatMoney(Math.max(0, -remaining), currency)} above the current FICONTER planning ceiling.`,
      detail: fits
        ? "This does not guarantee that a lender will approve the financing or that all ownership costs are covered. Add insurance, maintenance, taxes and any upfront payment before making the decision."
        : "Reducing the payment, waiting for stronger cash flow, lowering other commitments or improving the emergency reserve would make the decision less fragile.",
      tone: fits ? "positive" : "warning",
      confidence,
      dataCoverage: context.dataCoverage,
      evidence,
      scenarios: [
        {
          label: "Proposed",
          headline: `${formatMoney(amount, currency)} / month`,
          detail: fits ? "Inside the current planning ceiling." : "Outside the current planning ceiling.",
        },
        {
          label: "FICONTER ceiling",
          headline: `${formatMoney(safeRecurringCapacity, currency)} / month`,
          detail: "Calculated from dependable surplus with a protection buffer.",
        },
      ],
      followUps: ["What would make this payment safer?", "Should I buy or lease instead?"],
      disclaimer: DISCLAIMER,
    };
  }

  if (intent === "purchase_timeline" || intent === "savings_timeline") {
    if (amount === null) {
      return {
        intent,
        title: `When could you afford the ${subject}?`,
        verdict: "Add a target amount for an exact timeline",
        summary: `FICONTER currently sees about ${formatMoney(targetMonthlyCapacity, currency)} per month as a usable planning pace for a dedicated target without assuming that unrelated savings can be spent.`,
        detail:
          "Enter the target price or the down payment you want to build. FICONTER will estimate the timeline from the financial data currently in your vault.",
        tone: targetMonthlyCapacity > 0 ? "info" : "warning",
        confidence,
        dataCoverage: context.dataCoverage,
        evidence,
        scenarios: [],
        followUps: [
          `When could I afford a ${formatMoney(25000, currency)} car?`,
          `How long to save ${formatMoney(10000, currency)}?`,
        ],
        disclaimer: DISCLAIMER,
      };
    }

    if (targetMonthlyCapacity <= 0) {
      return {
        intent,
        title: `Timeline for ${formatMoney(amount, currency)}`,
        verdict: "No dependable target-building capacity is available right now",
        summary:
          "FICONTER will not create a false purchase date while your dependable monthly capacity is zero under the current protection guardrails.",
        detail:
          "Restore positive monthly cash flow, clear overdue commitments and strengthen the protection buffer first. The estimated timeline will then update automatically.",
        tone: "warning",
        confidence,
        dataCoverage: context.dataCoverage,
        evidence,
        scenarios: [],
        followUps: ["What should I improve first?", "Why is my current capacity zero?"],
        disclaimer: DISCLAIMER,
      };
    }

    const months = Math.max(1, Math.ceil(amount / targetMonthlyCapacity));
    const conservativeMonths = Math.max(1, Math.ceil(amount / Math.max(1, targetMonthlyCapacity * 0.75)));
    return {
      intent,
      title: `Timeline for ${formatMoney(amount, currency)}`,
      verdict: `Approximately ${months} months from zero dedicated funds`,
      summary: `At the current planning pace of about ${formatMoney(targetMonthlyCapacity, currency)} per month, the target would be reached around ${addMonthsLabel(months)}.`,
      detail:
        "This estimate intentionally does not assume that all previously recorded savings are available for this purchase. If you already have money specifically set aside for it, include that amount in your next question for a shorter and more precise timeline.",
      tone: emergencyMonths >= 3 ? "positive" : "info",
      confidence,
      dataCoverage: context.dataCoverage,
      evidence: [
        ...evidence,
        {
          key: "savings-pace",
          label: "Recorded monthly savings pace",
          value: savingsPace,
          format: "currency",
        },
        {
          key: "recorded-savings",
          label: "Recorded savings contributions",
          value: totalRecordedSavings,
          format: "currency",
          note: "Not automatically treated as available cash for this purchase.",
        },
      ],
      scenarios: [
        {
          label: "Current pace",
          headline: `${months} months`,
          detail: `Around ${addMonthsLabel(months)} if the current target-building pace is maintained.`,
        },
        {
          label: "More cautious",
          headline: `${conservativeMonths} months`,
          detail: "Uses 75% of the current target-building pace to allow for month-to-month variability.",
        },
      ],
      followUps: ["Can I afford financing instead?", "What monthly payment could I safely handle?"],
      disclaimer: DISCLAIMER,
    };
  }

  if (intent === "affordability") {
    if (amount === null) {
      return {
        intent,
        title: "Affordability check",
        verdict: "Add the price or payment you are considering",
        summary: `FICONTER currently sees about ${formatMoney(safeRecurringCapacity, currency)} per month as conservative recurring capacity.`,
        detail:
          "For a purchase, include the price or down payment. For financing, include the monthly payment. FICONTER will keep the answer tied to the numbers already recorded in your account.",
        tone: "info",
        confidence,
        dataCoverage: context.dataCoverage,
        evidence,
        scenarios: [],
        followUps: ["Can I afford a 400 monthly payment?", `When could I afford ${formatMoney(25000, currency)}?`],
        disclaimer: DISCLAIMER,
      };
    }

    const months = targetMonthlyCapacity > 0 ? Math.ceil(amount / targetMonthlyCapacity) : null;
    return {
      intent,
      title: `Can you afford ${formatMoney(amount, currency)}?`,
      verdict: months === null ? "Not safely from the current position" : "Treat this as a target, not an immediate yes",
      summary: months === null
        ? "Current dependable capacity is not positive enough for FICONTER to support adding this purchase now."
        : `From zero dedicated funds, the amount equals roughly ${months} months of your current target-building pace.`,
      detail:
        "A total purchase price and a monthly financing payment are different decisions. If you plan to finance it, ask again with the proposed monthly payment, down payment and term so FICONTER can evaluate the recurring pressure separately.",
      tone: months === null ? "warning" : "info",
      confidence,
      dataCoverage: context.dataCoverage,
      evidence,
      scenarios: months === null ? [] : [
        {
          label: "Target view",
          headline: `${months} months`,
          detail: `Approximate time from zero dedicated funds at ${formatMoney(targetMonthlyCapacity, currency)} per month.`,
        },
      ],
      followUps: ["Check a monthly financing payment", "Should I buy or lease?"],
      disclaimer: DISCLAIMER,
    };
  }

  if (intent === "debt_vs_savings") {
    let verdict = "Keep both moving";
    let summary = "Maintain required debt payments while continuing a sustainable savings habit.";
    let tone: AskFiconterTone = "info";

    if (emergencyMonths < 1) {
      verdict = "Build the first protection layer while keeping debt current";
      summary = `Your emergency coverage is ${emergencyMonths.toFixed(1)} months, so FICONTER would protect near-term liquidity before aggressively redirecting every spare euro to debt.`;
      tone = "warning";
    } else if (currentDebt > 0 && debtServiceRatio >= 25) {
      verdict = "Debt pressure deserves the larger share of extra capacity";
      summary = `Debt payments currently use about ${debtServiceRatio.toFixed(1)}% of recorded income, while your first emergency layer is already in place.`;
      tone = "warning";
    } else if (currentDebt <= 0) {
      verdict = "Savings can take priority because no active debt is recorded";
      summary = "FICONTER does not see an active debt balance in the current intelligence data.";
      tone = "positive";
    }

    return {
      intent,
      title: "Debt or savings first?",
      verdict,
      summary,
      detail:
        "FICONTER does not assume an interest rate that is not recorded in this decision context. If you want an interest-cost comparison, include the debt APR and balance or use the debt module data when available.",
      tone,
      confidence,
      dataCoverage: context.dataCoverage,
      evidence: [
        ...evidence,
        {
          key: "emergency-gap",
          label: "Emergency reserve gap",
          value: emergencyGap,
          format: "currency",
        },
      ],
      scenarios: [],
      followUps: ["How much extra could I put toward debt?", "How long until I have 3 months of emergency coverage?"],
      disclaimer: DISCLAIMER,
    };
  }

  if (intent === "spending_capacity") {
    return {
      intent,
      title: "Current recurring decision capacity",
      verdict: `${formatMoney(safeRecurringCapacity, currency)} per month`,
      summary:
        "This is FICONTER’s conservative recurring planning capacity from dependable positive free cash flow, not a bank borrowing limit.",
      detail:
        "The calculation deliberately leaves some free cash flow uncommitted and reduces capacity when emergency protection is thin, debt pressure is high, bills are overdue or recent cash flow is negative.",
      tone: safeRecurringCapacity > 0 ? "positive" : "warning",
      confidence,
      dataCoverage: context.dataCoverage,
      evidence,
      scenarios: [],
      followUps: ["Can I afford a 300 monthly payment?", "When can I afford a car?"],
      disclaimer: DISCLAIMER,
    };
  }

  if (intent === "financial_health") {
    return {
      intent,
      title: "Your Financial Health context",
      verdict: health.assessed ? `${health.score} / 100 · ${health.label}` : "Not assessed",
      summary: health.summary,
      detail: health.nextBestAction,
      tone: health.score >= 70 ? "positive" : health.score >= 45 ? "info" : "warning",
      confidence,
      dataCoverage: context.dataCoverage,
      evidence: [
        {
          key: "health-score",
          label: "Financial Health Score",
          value: health.score,
          format: "score",
        },
        ...evidence,
      ],
      scenarios: [],
      followUps: ["What should I improve first?", "How can I increase my monthly capacity?"],
      disclaimer: DISCLAIMER,
    };
  }

  const priority = report?.priorities[0];
  if (intent === "priority" && priority) {
    return {
      intent,
      title: "Your current financial priority",
      verdict: priority.title,
      summary: priority.insight,
      detail: priority.action,
      tone: priority.priority === "critical" ? "critical" : priority.priority === "high" ? "warning" : "info",
      confidence,
      dataCoverage: context.dataCoverage,
      evidence,
      scenarios: report?.actionPlan.slice(0, 3).map((step) => ({
        label: step.horizon,
        headline: step.title,
        detail: step.action,
      })) ?? [],
      followUps: ["Why is this my priority?", "What can I afford after I fix this?"],
      disclaimer: DISCLAIMER,
    };
  }

  return {
    intent: "general",
    title: "FICONTER financial context",
    verdict: priority?.title ?? "Your financial data is ready for a more specific question",
    summary: priority?.insight ?? report?.summary ?? "Ask about affordability, debt, savings, purchases, financing or your next financial priority.",
    detail: priority?.action ?? `Your current conservative recurring decision capacity is about ${formatMoney(safeRecurringCapacity, currency)} per month. Add a price, payment or target to make the answer more specific.`,
    tone: priority?.priority === "critical" ? "critical" : priority?.priority === "high" ? "warning" : "info",
    confidence,
    dataCoverage: context.dataCoverage,
    evidence,
    scenarios: [],
    followUps: [
      "When could I afford a car?",
      "Should I buy or lease a car?",
      "What should I improve first?",
      "How much can I safely commit each month?",
    ],
    disclaimer: DISCLAIMER,
  };
}
