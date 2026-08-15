import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function requireText(file, needles) {
  const source = read(file);
  for (const needle of needles) {
    if (!source.includes(needle)) {
      throw new Error(`${file} is missing Phase 3 requirement: ${needle}`);
    }
  }
}

requireText("app/api/exchange-rate/route.ts", [
  "requestedDate",
  "fx_rate_cache",
  "api.frankfurter.dev/v2/rate",
  "Frankfurter reference rate",
]);
requireText("lib/performance/exchangeRateCache.ts", [
  "date?: string | null",
  "HISTORICAL_CACHE_TTL_MS",
  "ficonter-fx:",
]);
requireText("components/CurrencyDisplayProvider.tsx", [
  "CurrencyDisplayProvider",
  "formatReportingAmount",
  "useHistoricalReportingRates",
  "BASE_CURRENCY_CHANGED_EVENT",
]);
requireText("lib/financialOptions.ts", [
  "formatReportingCurrency",
  "setReportingCurrencyRuntime",
]);
requireText("supabase/global_currency_engine_phase3.sql", [
  "create table if not exists public.fx_rate_cache",
  "enable row level security",
]);

const phase3Sql = read("supabase/global_currency_engine_phase3.sql").toLowerCase();
for (const forbidden of [
  "update public.transactions",
  "delete from public.transactions",
  "alter table public.transactions",
  "update public.bills",
  "update public.debts",
]) {
  if (phase3Sql.includes(forbidden)) {
    throw new Error(`Phase 3 must not rewrite financial records: found ${forbidden}`);
  }
}

const exchangeRoute = read("app/api/exchange-rate/route.ts");
if (exchangeRoute.includes("subscriptionApiAccessError")) {
  throw new Error("Base-currency display rates must not be blocked by a paid-plan API gate.");
}

const displayFiles = [
  "components/HorizonOverviewBoard.tsx",
  "components/HorizonCommandStrip.tsx",
  "components/DashboardLiveOverview.tsx",
  "components/FinancialGps.tsx",
  "components/FinancialHealthScore.tsx",
  "components/CashFlowIntelligence.tsx",
  "components/SavingsIntelligence.tsx",
  "components/EmergencyFundIntelligence.tsx",
  "components/NetWorthLive.tsx",
  "components/NetWorthGrowth.tsx",
  "components/WealthScore.tsx",
  "components/FinancialIndependence.tsx",
  "components/MonthlyPlanner.tsx",
  "components/TransactionLedger.tsx",
  "components/BillsManager.tsx",
  "components/DebtManager.tsx",
  "components/CreditCardsManager.tsx",
  "components/GoalsManager.tsx",
];

for (const file of displayFiles) {
  const source = read(file);
  if (!source.includes("formatReportingCurrency") && !source.includes("useCurrencyDisplay")) {
    throw new Error(`${file} is not connected to the Phase 3 currency display lens.`);
  }
}

console.log("Currency Engine Phase 3 verification passed.");
console.log("- Latest reference-rate endpoint: enabled");
console.log("- Historical date lookup: enabled");
console.log("- Shared server FX cache: enabled");
console.log("- Personal base-currency display lens: enabled");
console.log("- Original transaction fields rewritten: NO");
console.log("- Free-user base-currency conversion API: enabled");
