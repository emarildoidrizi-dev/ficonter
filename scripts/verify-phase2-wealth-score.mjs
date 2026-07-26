import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const expect = (condition, message) => checks.push({ condition, message });

const engine = read("lib/wealth/wealthScore.ts");
const component = read("components/WealthScore.tsx");
const netWorth = read("components/NetWorthLive.tsx");
const page = read("app/dashboard/net-worth/page.tsx");
const sql = read("supabase/phase2_wealth_score_engine.sql");

expect(engine.includes("calculateFinancialHealth"), "Wealth Score reuses Financial Health results");
expect(engine.includes("calculateWealthScore"), "Shared Wealth Score engine exists");
expect(engine.includes('version: "1.0"'), "Wealth Score is versioned");
expect(engine.includes('id: "net-position"'), "Net-position factor exists");
expect(engine.includes('id: "accumulation"'), "Accumulation factor exists");
expect(engine.includes('id: "debt-reduction"'), "Debt-reduction factor exists");
expect(engine.includes('id: "capital-balance"'), "Capital-balance factor exists");
expect(engine.includes('id: "momentum"'), "Momentum factor exists");
expect(engine.includes('id: "goals"'), "Goal-funding factor exists");
expect(engine.includes('id: "resilience"'), "Resilience factor exists");
expect(!component.includes("function calculateWealth"), "UI does not duplicate score calculations");
expect(component.includes("result: WealthScoreResult"), "UI consumes shared Wealth Score result");
expect(netWorth.includes("calculateWealthScore(inputs)"), "Net Worth calculates the shared result once");
expect(netWorth.includes('rpc(\n      "get_wealth_score_inputs"'), "Realtime refresh uses the aggregate Wealth RPC");
expect(netWorth.includes('table: "transactions"'), "Wealth Score listens to Transactions realtime");
expect(netWorth.includes('table: "debts"'), "Wealth Score listens to Debt realtime");
expect(netWorth.includes('table: "goals"'), "Wealth Score listens to Goals realtime");
expect(page.includes('rpc("get_wealth_score_inputs")'), "Net Worth server page loads one aggregate input source");
expect(!page.includes('.from("transactions")'), "Net Worth no longer maintains a parallel transaction query");
expect(!page.includes('.from("debts")'), "Net Worth no longer maintains a parallel debt query");
expect(sql.includes("public.get_financial_health_inputs()"), "SQL reuses Financial Health aggregate inputs");
expect(sql.includes("security invoker"), "Wealth RPC uses caller permissions");
expect(sql.includes("auth.uid()"), "Wealth RPC is scoped to the authenticated user");
expect(sql.includes("grant execute") && sql.includes("authenticated"), "Only authenticated users can execute the Wealth RPC");
expect(!sql.includes("service_role"), "Wealth SQL does not use service-role access");

const failures = checks.filter((check) => !check.condition);
for (const check of checks) {
  console.log(`${check.condition ? "PASS" : "FAIL"} ${check.message}`);
}

if (failures.length) {
  process.exitCode = 1;
} else {
  console.log(`\n${checks.length} Phase 2 Wealth Score checks passed.`);
}
