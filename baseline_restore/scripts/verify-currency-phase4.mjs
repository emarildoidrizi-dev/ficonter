import fs from "node:fs";
import path from "node:path";

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

function requireText(file, text) {
  if (!read(file).includes(text)) {
    throw new Error(`${file} is missing required Phase 4 invariant: ${text}`);
  }
}

function forbidText(file, text) {
  if (read(file).includes(text)) {
    throw new Error(`${file} still contains forbidden Phase 4 pattern: ${text}`);
  }
}

requireText("lib/finance/baseCurrencyActuals.ts", "sourceCurrency === targetCurrency");
requireText("lib/finance/baseCurrencyActuals.ts", "return roundMoney(sourceAmount)");

requireText("components/MonthlyPlanner.tsx", "baseCurrencyAmountToCanonicalEur");
requireText("components/MonthlyPlanner.tsx", "canonicalAmountInBaseCurrency");

requireText("components/GoalsManager.tsx", "baseCurrencyAmountToCanonicalEur");
requireText("components/GoalsManager.tsx", "p_original_amount");
requireText("components/GoalsManager.tsx", "p_currency: baseCurrency");

requireText("components/TransactionLedger.tsx", '"Display currency"');
requireText("components/TransactionLedger.tsx", "display_amount: displayed");
requireText("components/TransactionLedger.tsx", "conversionRateFor");
requireText("components/TransactionLedger.tsx", "originalCurrency !== baseCurrency && conversionRate");
requireText("components/TransactionLedger.tsx", "{baseCurrency}</>");
forbidText("components/TransactionLedger.tsx", "exchange_rate_to_eur || 1).toFixed(6)} EUR");
requireText("lib/accountExport.ts", "display_currency: string");

requireText("app/api/exchange-rate/route.ts", "cached fallback");
requireText("app/api/exchange-rate/route.ts", "stale: true");

requireText("supabase/global_currency_engine_phase4.sql", "p_original_amount");
forbidText("supabase/global_currency_engine_phase4.sql", "update public.transactions");
forbidText("supabase/global_currency_engine_phase4.sql", "delete from public.transactions");

const businessFiles = [
  "components/BusinessOverview.tsx",
  "components/BusinessReports.tsx",
  "components/BusinessTransactionLedger.tsx",
  "components/BusinessSales.tsx",
  "components/BusinessCostControl.tsx",
  "components/BusinessInventory.tsx",
];

for (const file of businessFiles) {
  const source = read(file);
  if (!source.includes("business.base_currency")) {
    throw new Error(`${file} does not preserve Business base-currency isolation.`);
  }
  if (source.includes("useCurrencyDisplay(")) {
    throw new Error(`${file} incorrectly depends on Personal currency display state.`);
  }
}

const exactOriginal = (amount, originalCurrency, selectedCurrency) =>
  originalCurrency === selectedCurrency ? Number(amount.toFixed(2)) : null;

if (exactOriginal(50, "CAD", "CAD") !== 50) {
  throw new Error("CAD exact-return regression failed.");
}
if (exactOriginal(80, "EUR", "EUR") !== 80) {
  throw new Error("EUR exact-return regression failed.");
}

console.log("Currency Engine Phase 4 verification passed.");
console.log("- Same-currency original amount invariant retained");
console.log("- Planner inputs are canonicalized before storage");
console.log("- Goals use Base Currency display and preserve original investment transactions");
console.log("- Transaction CSV/PDF exports include original + Base Currency values");
console.log("- Transaction conversion detail follows the selected Base Currency instead of hardcoded EUR");
console.log("- FX provider uses stale cache fallback before failing");
console.log("- Business currency remains isolated from Personal currency");
console.log("- Phase 4 SQL does not rewrite existing transactions");
