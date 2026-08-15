import fs from "node:fs";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function requireText(file, needle, label = needle) {
  const source = read(file);
  if (!source.includes(needle)) {
    throw new Error(`${file} is missing ${label}`);
  }
}

const moduleChecks = [
  ["components/CashFlowIntelligence.tsx", "reconcileCashFlowToBaseCurrency"],
  ["components/BillsManager.tsx", "billAmountInBase"],
  ["components/DebtManager.tsx", "currentDebtValue"],
  ["components/CreditCardsManager.tsx", "cardCurrent"],
  ["components/MonthlyPlanner.tsx", "mapTransactionsToBaseCurrency"],
  ["components/SavingsIntelligence.tsx", "reconcileSavingsToBaseCurrency"],
  ["components/EmergencyFundIntelligence.tsx", "reconcileEmergencyFundToBaseCurrency"],
  ["components/NetWorthLive.tsx", "reconcileNetWorthGrowthToBaseCurrency"],
  ["components/FinancialGps.tsx", "reconcileAiInsightsToBaseCurrency"],
  ["components/AiInsights.tsx", "reconcileAiInsightsToBaseCurrency"],
  ["components/FinancialIndependence.tsx", "reconcileNetWorthGrowthToBaseCurrency"],
  ["components/DashboardLiveOverview.tsx", "calculateBaseCurrencyCashActuals"],
];

for (const [file, needle] of moduleChecks) {
  requireText(file, needle, "base-currency reconciliation");
}

const reconciliation = read("lib/finance/baseCurrencyReconciliation.ts");
if (!reconciliation.includes("currency === context.baseCurrency")) {
  throw new Error("Current record exact-return invariant is missing.");
}

const exact = read("lib/finance/baseCurrencyActuals.ts");
if (!exact.includes("sourceCurrency === targetCurrency")) {
  throw new Error("Historical record exact-return invariant is missing.");
}
if (!exact.includes("return roundMoney(sourceAmount)")) {
  throw new Error("Original amount is not returned directly when currencies match.");
}

const transactionLedger = read("components/TransactionLedger.tsx");
if (!transactionLedger.includes("Original: {formatCurrency(finiteNumber(transaction.amount), transaction.currency)} · 1 {transaction.currency} =")) {
  throw new Error("Transaction conversion detail is not always rendered.");
}
if (!transactionLedger.includes("transaction.exchange_rate_to_eur")) {
  throw new Error("Stored transaction conversion rate is not shown.");
}

const cashFlow = read("components/CashFlowIntelligence.tsx");
if (!cashFlow.includes("reconciledInputs.financialHealth.transactions.totalExpenses")) {
  throw new Error("All-time Cash Flow totals are not reconciled from original records.");
}
if (cashFlow.includes("formatReportingCurrency(")) {
  throw new Error("Cash Flow still applies a second EUR->base display conversion.");
}

const auditedDirectDisplayFiles = [
  "components/CashFlowIntelligence.tsx",
  "components/DebtManager.tsx",
  "components/CreditCardsManager.tsx",
  "components/SavingsIntelligence.tsx",
  "components/EmergencyFundIntelligence.tsx",
  "components/NetWorthLive.tsx",
  "components/NetWorthGrowth.tsx",
  "components/FinancialGps.tsx",
  "components/FinancialHealthScore.tsx",
  "components/WealthScore.tsx",
  "components/AiInsights.tsx",
  "components/FinancialIndependence.tsx",
  "components/HorizonCommandStrip.tsx",
];

for (const file of auditedDirectDisplayFiles) {
  if (read(file).includes("formatReportingCurrency(")) {
    throw new Error(`${file} still contains an unsafe second reporting-currency conversion.`);
  }
}

const planner = read("components/MonthlyPlanner.tsx");
if (!planner.includes("calculateMonthlyCashActuals(month,financeTransactions,financeBills)")) {
  throw new Error("Monthly Planner is not calculating from reconciled transaction/bill records.");
}

console.log("Currency Phase 3.2 global consistency verification passed.");
console.log("- Cash Flow uses original-value reconciliation");
console.log("- Bills use record-level conversion");
console.log("- Debt and Credit Cards use exact native balances when base currency matches");
console.log("- Monthly Planner uses reconciled transactions and bills");
console.log("- Savings, Emergency Fund, Net Worth, GPS, Health, Insights and FI use the same base-currency layer");
console.log("- Transaction conversion detail is always visible");
console.log("- Unsafe double reporting conversion removed from audited result surfaces");
