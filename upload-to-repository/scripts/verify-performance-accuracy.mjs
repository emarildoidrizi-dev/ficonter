import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const check = (name, condition) => checks.push({ name, condition: Boolean(condition) });

const money = read("lib/finance/money.ts");
const realtime = read("lib/ficonterRealtime.ts");
const bridge = read("components/RealtimeRefreshBridge.tsx");
const client = read("lib/supabase/client.ts");
const rateCache = read("lib/performance/exchangeRateCache.ts");
const form = read("components/TransactionForm.tsx");
const ledger = read("components/TransactionLedger.tsx");
const planner = read("components/MonthlyPlanner.tsx");
const monthlyCashActuals = read("lib/finance/monthlyCashActuals.ts");
const bills = read("components/BillsManager.tsx");
const currentUser = read("lib/auth/currentUser.ts");
const adminAccess = read("lib/admin/access.ts");

check("Shared precision helpers preserve six-decimal reporting amounts", money.includes("CONVERTED_AMOUNT_DECIMALS") && money.includes("toMinorUnits(value, decimals)"));
check("Negative and positive rounding use a sign-safe implementation", money.includes("Math.abs(numeric) + Number.EPSILON"));
check("Browser Supabase clients are reused", client.includes("clientCache") && client.includes("if (cached) return cached"));
check("Exchange-rate calls are cached for one hour", rateCache.includes("60 * 60 * 1000") && rateCache.includes("pending"));
check("Exchange-rate requests are deduplicated", rateCache.includes("const existing = pending.get(key)") && rateCache.includes("return existing"));
check("Realtime changes carry a deduplication nonce", realtime.includes("nonce") && realtime.includes("DATA_SCOPE_SET"));
check("Realtime refreshes are debounced and rate-limited", bridge.includes("REFRESH_DEBOUNCE_MS") && bridge.includes("MIN_REFRESH_INTERVAL_MS"));
check("Hidden tabs postpone refresh work", bridge.includes('document.visibilityState !== "visible"'));
check("Transaction entry no longer rerenders once per second", !form.includes("setInterval("));
check("Transaction entry uses the cached exchange-rate service", form.includes("getExchangeRate") && form.includes("convertToReportingCurrency"));
check("Transaction search uses deferred rendering", ledger.includes("useDeferredValue") && ledger.includes("deferredSearch"));
check("Large ledgers progressively render records", ledger.includes("visibleLimit") && ledger.includes("Load 120 more"));
check("Ledger totals use precision-safe aggregation", ledger.includes("sumMoney(inflowValues)") && ledger.includes("sumMoney(netValues)"));
check("Planner assigns transactions by their local transaction date", planner.includes("transactionActivityDate") && monthlyCashActuals.includes("transaction.transaction_date ||") && monthlyCashActuals.includes("transaction.occurred_at?.slice(0, 10)"));
check("Planner assigns paid bills to one activity month", planner.includes("billActivityDate") && monthlyCashActuals.includes('bill.status === "paid"') && monthlyCashActuals.includes("bill.paid_at?.slice(0, 10)"));
check("Planner excludes linked bill transactions from expenses", planner.includes("paidBillTxIds.has(t.id)"));
check("Bills use the authenticated cached exchange-rate endpoint", bills.includes("convertWithCachedRate") && !bills.includes("api.frankfurter"));
check("Server dashboard auth is request-cached", currentUser.includes("cache(async () =>") && currentUser.includes("auth.getUser"));
check("Admin role lookup is request-cached", adminAccess.includes("requireAdmin = cache(async () =>"));

const dashboardPages = [
  "app/dashboard/page.tsx",
  "app/dashboard/transactions/page.tsx",
  "app/dashboard/bills/page.tsx",
  "app/dashboard/budget/page.tsx",
  "app/dashboard/cash-flow/page.tsx",
  "app/dashboard/debt/page.tsx",
  "app/dashboard/emergency-fund/page.tsx",
  "app/dashboard/financial-independence/page.tsx",
  "app/dashboard/goals/page.tsx",
  "app/dashboard/gps/page.tsx",
  "app/dashboard/inbox/page.tsx",
  "app/dashboard/insights/page.tsx",
  "app/dashboard/net-worth/page.tsx",
  "app/dashboard/savings/page.tsx",
  "app/dashboard/settings/page.tsx",
  "app/dashboard/setup/page.tsx",
];
check(
  "Dashboard pages reuse the request-cached authenticated client",
  dashboardPages.every((file) => {
    const source = read(file);
    return source.includes("getCurrentUser") && !source.includes("supabase.auth.getUser()");
  }),
);

const failed = checks.filter((item) => !item.condition);
for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"}  ${item.name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} performance/accuracy check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} performance and accuracy checks passed.`);
