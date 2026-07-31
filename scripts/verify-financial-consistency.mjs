import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require("typescript");
} catch {
  const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  ts = require(path.join(globalRoot, "typescript"));
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function compileModule(relativePath, moduleMap = {}) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    fileName: filename,
    reportDiagnostics: true,
  });
  const errors = (output.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(
    errors.length,
    0,
    errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n"),
  );

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier in moduleMap) return moduleMap[specifier];
    return require(specifier);
  };
  vm.runInNewContext(
    `(function(require, module, exports) {${output.outputText}\n})`,
    { console, structuredClone, Intl, Date, Math, JSON, Set, Map },
    { filename },
  )(localRequire, module, module.exports);
  return module.exports;
}

const averages = compileModule("lib/wealth/averagePeriods.ts");
const readiness = compileModule("lib/wealth/dataReadiness.ts");
const healthModule = compileModule("lib/wealth/financialHealth.ts", {
  "@/lib/wealth/dataReadiness": readiness,
});
const cashFlowModule = compileModule("lib/wealth/cashFlowIntelligence.ts", {
  "@/lib/wealth/financialHealth": healthModule,
});
const emergencyModule = compileModule("lib/wealth/emergencyFund.ts", {
  "@/lib/wealth/averagePeriods": averages,
  "@/lib/wealth/financialHealth": healthModule,
});
const savingsModule = compileModule("lib/wealth/savingsIntelligence.ts", {
  "@/lib/wealth/cashFlowIntelligence": cashFlowModule,
  "./averagePeriods": averages,
});
const wealthModule = compileModule("lib/wealth/wealthScore.ts", {
  "@/lib/wealth/financialHealth": healthModule,
});
const growthModule = compileModule("lib/wealth/netWorthGrowth.ts", {
  "@/lib/wealth/averagePeriods": averages,
  "@/lib/wealth/wealthScore": wealthModule,
});
const independenceModule = compileModule("lib/wealth/financialIndependence.ts", {
  "@/lib/wealth/emergencyFund": emergencyModule,
  "@/lib/wealth/netWorthGrowth": growthModule,
  "@/lib/wealth/savingsIntelligence": savingsModule,
});
const aiModule = compileModule("lib/wealth/aiInsights.ts", {
  "@/lib/wealth/cashFlowIntelligence": cashFlowModule,
  "@/lib/wealth/financialIndependence": independenceModule,
  "@/lib/wealth/wealthScore": wealthModule,
  "@/lib/wealth/dataReadiness": readiness,
});
const setupModule = compileModule("lib/wealth/setupReadiness.ts", {
  "@/lib/wealth/dataReadiness": readiness,
});
const gpsModule = compileModule("lib/wealth/financialGps.ts", {
  "@/lib/wealth/aiInsights": aiModule,
  "@/lib/wealth/setupReadiness": setupModule,
});

const healthInput = {
  schemaVersion: 2,
  generatedAt: "2026-07-31T12:00:00.000Z",
  transactions: {
    count: 10,
    totalIncome: 3464.79,
    totalExpenses: 539.95,
    totalSavings: 208.38,
    emergencyFundSavings: 104.19,
    goalInvestments: 0,
    debtPayments: 211.83,
    activeMonths: 2,
    incomeMonths: 1,
    expenseMonths: 1,
    currentMonthOutflow: 539.95,
  },
  bills: {
    count: 9,
    pendingCount: 6,
    overdueCount: 0,
    paidCount: 3,
    paidOnTimeCount: 3,
    dueNext30DaysCount: 5,
    pendingAmount: 1678.61,
    oneMonthAmount: 1678.61,
  },
  debts: {
    count: 6,
    activeCount: 6,
    originalBalance: 14280.05,
    currentBalance: 14068.22,
    minimumMonthlyPayment: 745.83,
    averageInterestRate: 0,
  },
  goals: {
    count: 1,
    activeCount: 1,
    completedCount: 0,
    totalTarget: 50000,
    totalCurrent: 0,
  },
  planner: {
    currentMonth: "2026-07",
    hasPlan: true,
    itemCount: 5,
    plannedIncome: 3464.79,
    plannedOutflow: 539.95,
  },
};

function approximately(actual, expected, tolerance = 0.01, message = "") {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    message || `Expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

const health = healthModule.calculateFinancialHealth(healthInput);
assert.equal(health.metrics.averageMonthlyExpenses, 539.95, "Expense average must use expense months, not saving-only months");
assert.equal(health.metrics.monthlyProtectionBaseline, 2424.44, "Protection baseline must include one-month bills and debt minimums");
assert.equal(health.metrics.netCashFlow, 2716.46, "Recorded position must reconcile income, expenses and savings");
approximately(health.metrics.savingsRate, 208.38 / 3464.79, 0.000001, "Total savings rate should reconcile to approximately 6.0%");
assert.ok(health.metrics.emergencyFundCoverageMonths < 0.05, "Emergency coverage must not be overstated by an incomplete expense baseline");

const cashFlowInput = {
  schemaVersion: 2,
  generatedAt: "2026-07-31T12:00:00.000Z",
  financialHealth: healthInput,
  monthly: [
    {
      month: "2026-07",
      transactionCount: 8,
      income: 3464.79,
      expenses: 539.95,
      savings: 0,
      outflow: 539.95,
      netCashFlow: 2924.84,
    },
  ],
  categories: [],
  commitments: {
    total: 2424.44,
    billsTotal: 1678.61,
    debtMinimums: 745.83,
    items: [],
  },
  planner: { hasPlan: true, plannedIncome: 3464.79, plannedOutflow: 539.95 },
};
const cashFlow = cashFlowModule.calculateCashFlowIntelligence(cashFlowInput);
assert.equal(cashFlow.metrics.knownCommitments, 2424.44);
approximately(cashFlow.metrics.projectedNetCashFlow, 1040.35);
approximately(cashFlow.metrics.projectedMargin, 1040.35 / 3464.79, 0.000001);

const emergencyInput = {
  schemaVersion: 2,
  generatedAt: "2026-07-31T12:00:00.000Z",
  financialHealth: healthInput,
  oneMonthCommitments: 2424.44,
  monthly: [{ month: "2026-07", contributionCount: 1, contribution: 104.19 }],
  recentContributions: [],
  stats: { contributionCount: 1, totalContributed: 104.19, firstContributionAt: null, lastContributionAt: null },
};
const emergency = emergencyModule.calculateEmergencyFund(emergencyInput);
assert.equal(emergency.metrics.protectionBaseline, 2424.44);
approximately(emergency.metrics.recommendedTarget, 14546.64, 0.01, "Six-month reserve must not be lower than one month of known commitments");
approximately(emergency.metrics.recommendedGap, 14442.45);

const raw = aiModule.normalizeAiInsightsInputs(null);
raw.generatedAt = "2026-07-31T12:00:00.000Z";
raw.cashFlow = cashFlowInput;
raw.financialIndependence.savingsIntelligence.cashFlow = cashFlowInput;
raw.financialIndependence.savingsIntelligence.monthlySavings = [
  { month: "2026-07", contributionCount: 1, savings: 104.19 },
];
raw.financialIndependence.savingsIntelligence.categories = [
  { category: "General savings", amount: 104.19, contributionCount: 1, latestAt: "2026-07-31T10:00:00.000Z" },
];
raw.financialIndependence.savingsIntelligence.stats = {
  totalAmount: 104.19,
  contributionCount: 1,
  firstContributionAt: "2026-07-31T10:00:00.000Z",
  lastContributionAt: "2026-07-31T10:00:00.000Z",
};
raw.financialIndependence.emergencyFund = emergencyInput;
raw.financialIndependence.netWorthGrowth.generatedAt = "2026-07-31T12:00:00.000Z";
raw.financialIndependence.netWorthGrowth.wealthScore.financialHealth = healthInput;
raw.financialIndependence.netWorthGrowth.wealthScore.wealth = {
  availableCash: 2716.46,
  recordedSavings: 208.38,
  recordedCapital: 2924.84,
  currentDebt: 14068.22,
  netWorth: -11143.38,
  recent3MonthIncome: 3464.79,
  recent3MonthRetainedCapital: 2924.84,
  prior3MonthIncome: 0,
  prior3MonthRetainedCapital: 0,
  historyMonths: 1,
};
raw.financialIndependence.netWorthGrowth.wealthScore.monthly = [];
raw.financialIndependence.netWorthGrowth.wealthScore.liabilities = [];
raw.financialIndependence.netWorthGrowth.growth = {
  firstMonth: "2026-07",
  historyMonths: 1,
  monthly: [
    {
      month: "2026-07",
      transactionCount: 8,
      income: 3464.79,
      expenses: 539.95,
      savings: 0,
      retainedCapital: 2924.84,
      availableCashChange: 2924.84,
      cumulativeCapital: 2924.84,
      cumulativeSavings: 0,
      debtOutstanding: 14068.22,
      debtPayments: 211.83,
      debtChange: 14068.22,
      netWorth: -11143.38,
      netWorthChange: -11143.38,
    },
  ],
};
raw.financialIndependence.settings = {
  targetMonthlySpending: 0,
  withdrawalRate: 4,
  annualRealReturnRate: 4,
  updatedAt: null,
};

const context = aiModule.calculateAiInsightsContext(raw);
approximately(context.evidence.cash_flow_margin.value, 78.4, 0.01, "Ratio values must be converted to percentage points for display and rules");
approximately(context.evidence.debt_service_ratio.value, 21.5, 0.05, "Debt service ratio must display as 21.5%, not 0.2%");
approximately(context.evidence.savings_rate.value, 3, 0.01, "Non-emergency savings rate must display as 3.0%");
assert.equal(context.evidence.goal_progress.value, 0);
assert.match(context.evidence.known_commitments.label, /one-month/i);

const independence = independenceModule.calculateFinancialIndependence(raw.financialIndependence);
assert.ok(independence.assumptions.targetMonthlySpending > 0, "A saved zero target must fall back to the current protection baseline");
assert.ok(independence.metrics.financialIndependenceTarget > 0, "Financial Independence target must not remain zero when financial records exist");
assert.ok(independence.milestones.every((item) => item.amount > 0), "Capital milestones must not render meaningless zero targets");
assert.match(independence.readiness[0].detail, /liabilities/i, "Negative net worth must not be described as missing liability records");

const gps = gpsModule.calculateFinancialGps(raw, {
  noBills: false,
  debtFree: false,
  noSavingsYet: false,
  noGoalsYet: false,
  updatedAt: null,
});
const gpsRoutes = gps.actionPath.map((item) => item.href);
assert.equal(new Set(gpsRoutes).size, gpsRoutes.length, "Financial GPS must not repeat the same module action twice");
assert.match(gps.summary, /^The clearest current priority is to /i, "Financial GPS summary grammar must be natural");

const growthWithOpenMonth = growthModule.calculateNetWorthGrowth({
  ...raw.financialIndependence.netWorthGrowth,
  generatedAt: "2026-08-01T08:00:00.000Z",
  growth: {
    firstMonth: "2026-07",
    historyMonths: 2,
    monthly: [
      raw.financialIndependence.netWorthGrowth.growth.monthly[0],
      {
        ...raw.financialIndependence.netWorthGrowth.growth.monthly[0],
        month: "2026-08",
        netWorth: -11000,
        netWorthChange: 143.38,
      },
    ],
  },
}, "all");
assert.equal(growthWithOpenMonth.hasHistory, false, "An open current month must not count as a completed month-end comparison");
assert.equal(growthWithOpenMonth.metrics.selectedPeriodChange, 0);

const consolidatedSql = fs.readFileSync(
  path.join(root, "supabase/financial_consistency_hardening_v1.sql"),
  "utf8",
);
assert.equal((consolidatedSql.match(/^begin;$/gim) ?? []).length, 1, "Consolidated migration must have one transaction boundary");
assert.equal((consolidatedSql.match(/^commit;$/gim) ?? []).length, 1, "Consolidated migration must commit exactly once");
assert.equal((consolidatedSql.match(/notify\s+pgrst,\s*'reload schema';/gi) ?? []).length, 1, "Consolidated migration must reload the API schema once");
assert.equal((consolidatedSql.match(/\$\$/g) ?? []).length % 2, 0, "Consolidated SQL dollar quotes must be balanced");
for (const functionName of [
  "get_financial_health_inputs",
  "get_cash_flow_intelligence_inputs_v2",
  "get_savings_intelligence_inputs",
  "get_emergency_fund_intelligence_inputs",
  "get_wealth_score_inputs",
  "get_net_worth_growth_inputs",
  "get_financial_independence_inputs",
  "get_ai_insights_inputs",
]) {
  assert.match(consolidatedSql, new RegExp(`create or replace function public\\.${functionName}\\(`, "i"));
}
assert.match(consolidatedSql, /target_monthly_spending is null or target_monthly_spending > 0/i);

console.log("Financial consistency verification passed: 35 semantic and migration checks.");
