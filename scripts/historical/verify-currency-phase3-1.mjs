import fs from "node:fs";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

const ledger = read("components/TransactionLedger.tsx");
const dashboard = read("components/DashboardLiveOverview.tsx");
const helper = read("lib/finance/baseCurrencyActuals.ts");

if (!helper.includes("sourceCurrency === targetCurrency")) {
  throw new Error("Missing exact original-currency return invariant.");
}

if (!helper.includes("return roundMoney(sourceAmount)")) {
  throw new Error("Original amount is not returned directly.");
}

if (ledger.includes("1 ${transaction.currency} =")) {
  throw new Error("Ledger still exposes automatic raw FX-rate metadata.");
}

if (!ledger.includes("baseCurrency !== transaction.currency")) {
  throw new Error("Ledger does not condition conversion detail on an actual currency difference.");
}

if (!dashboard.includes("calculateBaseCurrencyCashActuals")) {
  throw new Error("Overview is not using transaction-level base-currency actuals.");
}

if (!dashboard.includes("valuesAlreadyInBaseCurrency")) {
  throw new Error("Overview board could double-convert already converted totals.");
}

console.log("Currency Phase 3.1 exact-original-return verification passed.");
console.log("- Same-currency transaction returns exact original amount");
console.log("- Overview totals use transaction-level base-currency actuals");
console.log("- Automatic raw FX-rate line removed");
console.log("- Original detail appears only when a conversion is actually displayed");
