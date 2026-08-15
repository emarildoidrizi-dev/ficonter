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
    errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n"),
  );

  const compiledModule = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier in moduleMap) return moduleMap[specifier];
    return require(specifier);
  };

  vm.runInNewContext(
    `(function(require, module, exports) {${output.outputText}\n})`,
    { console },
    { filename },
  )(localRequire, compiledModule, compiledModule.exports);

  return compiledModule.exports;
}

const readinessModule = compileModule("lib/wealth/dataReadiness.ts");
const setupModule = compileModule("lib/wealth/setupReadiness.ts", {
  "@/lib/wealth/dataReadiness": readinessModule,
});

const {
  calculateFinancialSetup,
  readSetupAcknowledgements,
  EMPTY_SETUP_ACKNOWLEDGEMENTS,
} = setupModule;

function inputs() {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
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
      currentMonth: "2026-07",
      hasPlan: false,
      itemCount: 0,
      plannedIncome: 0,
      plannedOutflow: 0,
    },
  };
}

const empty = calculateFinancialSetup(inputs(), EMPTY_SETUP_ACKNOWLEDGEMENTS);
assert.equal(empty.completionPercentage, 0);
assert.equal(empty.scoreReady, false);
assert.equal(empty.nextStep.id, "income");

const incomeOnlyInputs = inputs();
incomeOnlyInputs.transactions.count = 1;
incomeOnlyInputs.transactions.totalIncome = 3000;
incomeOnlyInputs.transactions.incomeMonths = 1;
const incomeOnly = calculateFinancialSetup(
  incomeOnlyInputs,
  EMPTY_SETUP_ACKNOWLEDGEMENTS,
);
assert.equal(incomeOnly.completedCount, 1);
assert.equal(incomeOnly.scoreReady, false);
assert.equal(incomeOnly.nextStep.id, "expenses");

const cashFlowInputs = structuredClone(incomeOnlyInputs);
cashFlowInputs.transactions.count = 2;
cashFlowInputs.transactions.totalExpenses = 1500;
cashFlowInputs.transactions.currentMonthOutflow = 1500;
const cashFlow = calculateFinancialSetup(
  cashFlowInputs,
  EMPTY_SETUP_ACKNOWLEDGEMENTS,
);
assert.equal(cashFlow.scoreReady, true);
assert.equal(cashFlow.scoreReadinessLabel, "Preliminary");

const confirmations = {
  noBills: true,
  debtFree: true,
  noSavingsYet: true,
  noGoalsYet: true,
  updatedAt: new Date().toISOString(),
};
const completeInputs = structuredClone(cashFlowInputs);
completeInputs.planner.hasPlan = true;
completeInputs.planner.itemCount = 3;
completeInputs.planner.plannedIncome = 3000;
completeInputs.planner.plannedOutflow = 1500;
const complete = calculateFinancialSetup(completeInputs, confirmations);
assert.equal(complete.profileComplete, true);
assert.equal(complete.completionPercentage, 100);
assert.equal(complete.scoreReadinessLabel, "Ready");
assert.equal(complete.confirmedEmptyCount, 4);

const stored = readSetupAcknowledgements({
  ficonter_setup: {
    no_bills: true,
    debt_free: true,
    no_savings_yet: false,
    no_goals_yet: true,
    updated_at: "2026-07-28T00:00:00.000Z",
  },
});
assert.equal(stored.noBills, true);
assert.equal(stored.debtFree, true);
assert.equal(stored.noSavingsYet, false);
assert.equal(stored.noGoalsYet, true);

const requiredFiles = [
  "app/dashboard/setup/page.tsx",
  "components/FinancialSetupGuide.tsx",
  "components/FinancialSetupGuide.module.css",
  "lib/wealth/setupReadiness.ts",
];
for (const relativePath of requiredFiles) {
  assert.equal(fs.existsSync(path.join(root, relativePath)), true, `${relativePath} is missing`);
}

const dashboardSource = fs.readFileSync(
  path.join(root, "components/DashboardLiveOverview.tsx"),
  "utf8",
);
assert.match(dashboardSource, /initialSetupAcknowledgements/);
assert.match(dashboardSource, /calculateFinancialGps\(gpsInputs, initialSetupAcknowledgements\)/);

const overviewPageSource = fs.readFileSync(
  path.join(root, "app/dashboard/overview/page.tsx"),
  "utf8",
);
assert.match(overviewPageSource, /readSetupAcknowledgements/);
assert.match(overviewPageSource, /initialSetupAcknowledgements=/);

const transactionPage = fs.readFileSync(
  path.join(root, "app/dashboard/transactions/page.tsx"),
  "utf8",
);
assert.match(transactionPage, /setupTransactionType/);
assert.match(transactionPage, /initialType=\{initialType\}/);

console.log("Financial setup verification passed against the current unified Overview integration.");
