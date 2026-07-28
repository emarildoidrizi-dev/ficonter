import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
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
    errors
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      )
      .join("\n"),
  );

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier in moduleMap) return moduleMap[specifier];
    return require(specifier);
  };

  vm.runInNewContext(
    `(function(require, module, exports) {${output.outputText}\n})`,
    { console, structuredClone },
    { filename },
  )(localRequire, module, module.exports);

  return module.exports;
}

const averages = compileModule("lib/wealth/averagePeriods.ts");
const readiness = compileModule("lib/wealth/dataReadiness.ts");
const health = compileModule("lib/wealth/financialHealth.ts", {
  "@/lib/wealth/dataReadiness": readiness,
});
const cashFlow = compileModule("lib/wealth/cashFlowIntelligence.ts", {
  "@/lib/wealth/financialHealth": health,
});
const emergency = compileModule("lib/wealth/emergencyFund.ts", {
  "@/lib/wealth/averagePeriods": averages,
  "@/lib/wealth/financialHealth": health,
});
const savings = compileModule("lib/wealth/savingsIntelligence.ts", {
  "@/lib/wealth/cashFlowIntelligence": cashFlow,
  "./averagePeriods": averages,
});
const wealth = compileModule("lib/wealth/wealthScore.ts", {
  "@/lib/wealth/financialHealth": health,
});
const growth = compileModule("lib/wealth/netWorthGrowth.ts", {
  "@/lib/wealth/averagePeriods": averages,
  "@/lib/wealth/wealthScore": wealth,
});
const independence = compileModule("lib/wealth/financialIndependence.ts", {
  "@/lib/wealth/emergencyFund": emergency,
  "@/lib/wealth/netWorthGrowth": growth,
  "@/lib/wealth/savingsIntelligence": savings,
});
const ai = compileModule("lib/wealth/aiInsights.ts", {
  "@/lib/wealth/cashFlowIntelligence": cashFlow,
  "@/lib/wealth/financialIndependence": independence,
  "@/lib/wealth/wealthScore": wealth,
  "@/lib/wealth/dataReadiness": readiness,
});
const setup = compileModule("lib/wealth/setupReadiness.ts", {
  "@/lib/wealth/dataReadiness": readiness,
});
const gpsModule = compileModule("lib/wealth/financialGps.ts", {
  "@/lib/wealth/aiInsights": ai,
  "@/lib/wealth/setupReadiness": setup,
});

const { calculateFinancialGps, FINANCIAL_GPS_STAGES } = gpsModule;
const { normalizeAiInsightsInputs } = ai;
const { EMPTY_SETUP_ACKNOWLEDGEMENTS } = setup;

function baselineHealth({ income = 0, expenses = 0, savingsAmount = 0 } = {}) {
  return {
    schemaVersion: 1,
    generatedAt: "2026-07-28T12:00:00.000Z",
    transactions: {
      count: [income, expenses, savingsAmount].filter((value) => value > 0).length,
      totalIncome: income,
      totalExpenses: expenses,
      totalSavings: savingsAmount,
      emergencyFundSavings: 0,
      goalInvestments: 0,
      debtPayments: 0,
      activeMonths: income || expenses || savingsAmount ? 1 : 0,
      incomeMonths: income ? 1 : 0,
      currentMonthOutflow: expenses + savingsAmount,
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
      currentMonth: "2026-07",
      hasPlan: false,
      itemCount: 0,
      plannedIncome: 0,
      plannedOutflow: 0,
    },
  };
}

function inputsFor({ income = 0, expenses = 0, savingsAmount = 0 } = {}) {
  const result = normalizeAiInsightsInputs(null);
  const financialHealth = baselineHealth({ income, expenses, savingsAmount });
  const month = {
    month: "2026-07",
    transactionCount: financialHealth.transactions.count,
    income,
    expenses,
    savings: savingsAmount,
    outflow: expenses + savingsAmount,
    netCashFlow: income - expenses - savingsAmount,
  };

  result.generatedAt = "2026-07-28T12:00:00.000Z";
  result.cashFlow.financialHealth = financialHealth;
  result.cashFlow.monthly = financialHealth.transactions.count ? [month] : [];
  result.financialIndependence.savingsIntelligence.cashFlow = result.cashFlow;
  result.financialIndependence.savingsIntelligence.monthlySavings = savingsAmount
    ? [{ month: "2026-07", contributionCount: 1, savings: savingsAmount }]
    : [];
  result.financialIndependence.emergencyFund.financialHealth = financialHealth;
  result.financialIndependence.netWorthGrowth.wealthScore.financialHealth = financialHealth;
  result.financialIndependence.netWorthGrowth.wealthScore.wealth.availableCash =
    income - expenses - savingsAmount;
  result.financialIndependence.netWorthGrowth.wealthScore.wealth.recordedCapital =
    Math.max(0, income - expenses);
  result.financialIndependence.netWorthGrowth.wealthScore.wealth.netWorth =
    income - expenses;
  return result;
}

assert.equal(FINANCIAL_GPS_STAGES.length, 6);
assert.deepEqual(
  Array.from(FINANCIAL_GPS_STAGES, (stage) => stage.id),
  ["setup", "stabilize", "protect", "build", "grow", "freedom"],
);

const empty = calculateFinancialGps(
  inputsFor(),
  EMPTY_SETUP_ACKNOWLEDGEMENTS,
);
assert.equal(empty.stage.id, "setup");
assert.match(empty.primaryAction.title, /income/i);
assert.equal(empty.active, false);
assert.equal(empty.metrics[0].value, null);

const incomeOnly = calculateFinancialGps(
  inputsFor({ income: 3000 }),
  EMPTY_SETUP_ACKNOWLEDGEMENTS,
);
assert.equal(incomeOnly.stage.id, "setup");
assert.match(incomeOnly.primaryAction.title, /expense/i);
assert.equal(incomeOnly.confidenceLabel, "Waiting for baseline");

const confirmations = {
  noBills: true,
  debtFree: true,
  noSavingsYet: true,
  noGoalsYet: true,
  updatedAt: "2026-07-28T12:00:00.000Z",
};
const completeInputs = inputsFor({ income: 3000, expenses: 1700 });
completeInputs.cashFlow.financialHealth.planner = {
  currentMonth: "2026-07",
  hasPlan: true,
  itemCount: 4,
  plannedIncome: 3000,
  plannedOutflow: 1700,
};
completeInputs.cashFlow.planner = {
  hasPlan: true,
  plannedIncome: 3000,
  plannedOutflow: 1700,
};
completeInputs.financialIndependence.savingsIntelligence.cashFlow =
  completeInputs.cashFlow;
completeInputs.financialIndependence.emergencyFund.financialHealth =
  completeInputs.cashFlow.financialHealth;
completeInputs.financialIndependence.netWorthGrowth.wealthScore.financialHealth =
  completeInputs.cashFlow.financialHealth;

const active = calculateFinancialGps(completeInputs, confirmations);
assert.equal(active.active, true);
assert.notEqual(active.stage.id, "setup");
assert.equal(active.setupCompletion, 100);
assert.equal(active.actionPath.length >= 1, true);
assert.equal(active.metrics.length, 4);
assert.equal(active.metrics.find((item) => item.id === "debt")?.caption, "Confirmed debt-free");
assert.match(active.primaryAction.href, /^\/dashboard/);

const negativeInputs = inputsFor({ income: 2000, expenses: 2600 });
negativeInputs.cashFlow.financialHealth.planner = {
  currentMonth: "2026-07",
  hasPlan: true,
  itemCount: 3,
  plannedIncome: 2000,
  plannedOutflow: 2600,
};
negativeInputs.cashFlow.planner = {
  hasPlan: true,
  plannedIncome: 2000,
  plannedOutflow: 2600,
};
negativeInputs.financialIndependence.savingsIntelligence.cashFlow =
  negativeInputs.cashFlow;
negativeInputs.financialIndependence.emergencyFund.financialHealth =
  negativeInputs.cashFlow.financialHealth;
negativeInputs.financialIndependence.netWorthGrowth.wealthScore.financialHealth =
  negativeInputs.cashFlow.financialHealth;
const negative = calculateFinancialGps(negativeInputs, confirmations);
assert.equal(negative.stage.id, "stabilize");
assert.equal(
  negative.metrics.find((item) => item.id === "cash-flow")?.tone,
  "critical",
);

const requiredFiles = [
  "app/dashboard/gps/page.tsx",
  "components/FinancialGps.tsx",
  "components/FinancialGps.module.css",
  "components/FinancialGpsSummary.tsx",
  "components/FinancialGpsSummary.module.css",
  "lib/wealth/financialGps.ts",
];
for (const relativePath of requiredFiles) {
  assert.equal(
    fs.existsSync(path.join(root, relativePath)),
    true,
    `${relativePath} is missing`,
  );
}

const sidebar = fs.readFileSync(path.join(root, "components/Sidebar.tsx"), "utf8");
assert.match(sidebar, /\/dashboard\/gps/);
assert.match(sidebar, /Financial GPS/);

const overview = fs.readFileSync(
  path.join(root, "components/DashboardLiveOverview.tsx"),
  "utf8",
);
assert.match(overview, /FinancialGpsSummary/);
assert.match(overview, /get_ai_insights_inputs/);

const component = fs.readFileSync(
  path.join(root, "components/FinancialGps.tsx"),
  "utf8",
);
assert.match(component, /One clear priority/);
assert.match(component, /never moves money/i);
assert.match(component, /postgres_changes/);

console.log("Financial GPS verification passed: 32 checks.");
