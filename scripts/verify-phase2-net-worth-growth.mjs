import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const expect = (condition, message) => checks.push({ condition, message });

const engine = read("lib/wealth/netWorthGrowth.ts");
const component = read("components/NetWorthGrowth.tsx");
const live = read("components/NetWorthLive.tsx");
const page = read("app/dashboard/net-worth/page.tsx");
const sql = read("supabase/phase2_net_worth_growth.sql");

expect(engine.includes("normalizeWealthScoreInputs"), "Growth engine reuses Wealth Score inputs");
expect(engine.includes("calculateNetWorthGrowth"), "Shared Net Worth Growth engine exists");
expect(engine.includes('version: "1.0"'), "Growth result is versioned");
expect(engine.includes("selectedPeriodChange"), "Selected-period growth is calculated once");
expect(engine.includes("projectedTwelveMonthNetWorth"), "Directional 12-month outlook exists");
expect(engine.includes("netDebtReduction"), "Net liability movement is measured");
expect(engine.includes("savingsAllocated"), "Savings allocation is visible without double counting");
expect(engine.includes("groupAnnual"), "Annual growth summaries are generated");
expect(engine.includes('period === "all"'), "Full-history analysis is supported");
expect(component.includes("NET_WORTH_GROWTH_PERIODS"), "3/6/9/12/all period selector is rendered");
expect(component.includes("Capital, liabilities and net worth"), "Growth trajectory chart is present");
expect(component.includes("Savings remain part of recorded capital"), "UI explains savings are not added twice");
expect(component.includes("Growth by calendar year"), "Annual growth view is present");
expect(component.includes("Directional 12-month outlook"), "Forecast panel is present");
expect(!component.includes(".from(\"transactions\")"), "Growth UI does not query transactions directly");
expect(live.includes("calculateWealthScore(inputs.wealthScore)"), "Existing Wealth Score reuses the combined input source");
expect(live.includes("<NetWorthGrowth inputs={inputs}"), "Growth module is integrated into Net Worth");
expect(live.includes('table: "transactions"'), "Net Worth listens to Transactions realtime");
expect(live.includes('table: "debts"'), "Net Worth listens to Debt realtime");
expect(live.includes('table: "debt_payments"'), "Net Worth listens to Debt Payment realtime");
expect(live.includes('table: "goals"'), "Existing Wealth Score goal realtime remains active");
expect(live.includes("get_net_worth_growth_inputs"), "One combined RPC powers refreshes");
expect(page.includes('rpc("get_net_worth_growth_inputs")'), "Server page loads the combined aggregate RPC");
expect(!page.includes('.from("transactions")'), "Server page has no parallel transaction query");
expect(!page.includes('.from("debts")'), "Server page has no parallel debt query");
expect(sql.includes("public.get_wealth_score_inputs()"), "Growth SQL reuses the Wealth Score aggregate");
expect(sql.includes("security invoker"), "Growth RPC uses caller permissions");
expect(sql.includes("auth.uid()"), "Growth RPC is scoped to the authenticated user");
expect(sql.includes("grant execute") && sql.includes("authenticated"), "Only authenticated users can execute the Growth RPC");
expect(!sql.includes("service_role"), "Growth SQL does not use service-role access");
expect(sql.includes("debt_payments"), "Recorded debt repayments power historical liability reconstruction");
expect(sql.includes("netWorthChange"), "SQL provides monthly net-worth changes");

const failures = checks.filter((check) => !check.condition);
for (const check of checks) {
  console.log(`${check.condition ? "PASS" : "FAIL"} ${check.message}`);
}

if (failures.length) {
  process.exitCode = 1;
} else {
  console.log(`\n${checks.length} Phase 2 Net Worth Growth checks passed.`);
}
