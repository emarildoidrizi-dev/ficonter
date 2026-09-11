import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function compileEngine(aiModule) {
  const filename = path.join(root, "lib/wealth/askFiconter.ts");
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

  const compiled = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === "@/lib/wealth/aiInsights") return aiModule;
    return require(specifier);
  };

  vm.runInNewContext(
    `(function(require, module, exports) {${output.outputText}\n})`,
    { console, Intl, Date, Number, Math },
    { filename },
  )(localRequire, compiled, compiled.exports);

  return compiled.exports;
}

function financialContext(overrides = {}) {
  const metrics = {
    averageMonthlyIncome: 4000,
    averageMonthlyOutflow: 2600,
    averageMonthlyNetCashFlow: 1400,
    currentMonthNetCashFlow: 1300,
    projectedNetCashFlow: 1200,
    leftAfterPayments: 1250,
    ...overrides.cashMetrics,
  };
  const healthMetrics = {
    currentDebt: 5000,
    debtServiceRatio: 0.12,
    overdueBills: 0,
    ...overrides.healthMetrics,
  };
  const emergencyMetrics = {
    coverageMonths: 3.5,
    recommendedGap: 0,
    ...overrides.emergencyMetrics,
  };
  const savingsMetrics = {
    baselineMonthlySavings: 700,
    totalSaved: 8000,
    ...overrides.savingsMetrics,
  };

  return {
    assessed: overrides.assessed ?? true,
    dataCoverage: overrides.dataCoverage ?? 82,
    confidence: overrides.confidence ?? "High",
    sources: {
      cashFlow: {
        forecastAvailable: overrides.forecastAvailable ?? true,
        metrics,
        health: {
          assessed: true,
          score: 74,
          label: "Stable",
          summary: "Your recorded financial position is stable.",
          nextBestAction: "Keep commitments inside dependable cash flow.",
          metrics: healthMetrics,
        },
      },
      financialIndependence: {
        sources: {
          savings: { metrics: savingsMetrics },
          emergency: { metrics: emergencyMetrics },
        },
      },
    },
  };
}

let currentContext = financialContext();
const aiModule = {
  calculateAiInsightsContext: () => currentContext,
  generateSmartInsightReport: () => ({
    summary: "Maintain positive cash flow.",
    priorities: [
      {
        title: "Protect monthly flexibility",
        insight: "Your position is stable, so preserve flexibility before adding commitments.",
        action: "Keep new payments within dependable surplus.",
        priority: "medium",
      },
    ],
    actionPlan: [
      {
        horizon: "This month",
        title: "Keep a cash-flow buffer",
        action: "Leave part of positive cash flow uncommitted.",
      },
    ],
  }),
};

const { askFiconter } = compileEngine(aiModule);

const timeline = askFiconter("When could I afford a €25,000 car?", {}, "EUR");
assert.equal(timeline.intent, "purchase_timeline");
assert.match(timeline.verdict, /months/i);
assert.ok(timeline.evidence.some((item) => item.key === "safe-capacity"));

const payment = askFiconter("Can I afford a €350 monthly payment?", {}, "EUR");
assert.equal(payment.intent, "monthly_commitment");
assert.equal(payment.tone, "positive");
assert.match(payment.summary, /350/);

const expensivePayment = askFiconter("Can I afford a €1,000 monthly payment?", {}, "EUR");
assert.equal(expensivePayment.intent, "monthly_commitment");
assert.equal(expensivePayment.tone, "warning");

const lease = askFiconter("Should I buy or lease a car?", {}, "EUR");
assert.equal(lease.intent, "lease_or_buy");
assert.equal(lease.scenarios.length, 2);

const mismatch = askFiconter("When can I afford a $25,000 car?", {}, "EUR");
assert.match(mismatch.verdict, /base currency is EUR/i);

currentContext = financialContext({
  emergencyMetrics: { coverageMonths: 0.4, recommendedGap: 6000 },
  cashMetrics: { averageMonthlyNetCashFlow: -100, currentMonthNetCashFlow: -250 },
});
const unsafe = askFiconter("Should I buy or lease a car?", {}, "EUR");
assert.equal(unsafe.tone, "warning");
assert.match(unsafe.verdict, /wait/i);

currentContext = financialContext({ assessed: false, cashMetrics: { averageMonthlyIncome: 0 } });
const insufficient = askFiconter("Can I afford a car?", {}, "EUR");
assert.match(insufficient.verdict, /not enough verified data/i);

console.log("Ask FICONTER verification passed: intent, affordability, protection, evidence and currency guardrails.");
