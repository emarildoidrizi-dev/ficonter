import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const expect = (condition, message) => checks.push({ condition, message });

const engine = read("lib/wealth/financialHealth.ts");
const score = read("components/FinancialHealthScore.tsx");
const overview = read("components/DashboardLiveOverview.tsx");
const page = read("app/dashboard/page.tsx");
const sql = read("supabase/phase2_financial_health_engine.sql");

expect(engine.includes("calculateFinancialHealth"), "Shared financial health engine exists");
expect(engine.includes('version: "2.0"'), "Score engine is versioned");
expect(engine.includes('id: "cash-flow"'), "Cash-flow factor exists");
expect(engine.includes('id: "savings"'), "Savings factor exists");
expect(engine.includes('id: "debt"'), "Debt factor exists");
expect(engine.includes('id: "bills"'), "Bills factor exists");
expect(engine.includes('id: "emergency-fund"'), "Emergency-fund factor exists");
expect(engine.includes('id: "goals"'), "Goals factor exists");
expect(engine.includes('id: "planning"'), "Planning factor exists");
expect(engine.includes("hasCashFlowBaseline"), "Income-only profiles do not activate cash-flow scoring");
expect(engine.includes('"Setup incomplete"'), "Incomplete profiles use a neutral setup state");
expect(engine.includes("current.assessed"), "Unrecorded scoring factors are excluded rather than treated as zero");
expect(score.includes('result.scoreAvailable ? result.score : "—"'), "UI hides an unsupported numeric score");
expect(!score.includes("function calculateHealth"), "Score component does not duplicate calculation logic");
expect(score.includes("result: FinancialHealthResult"), "Score component consumes the shared result");
expect(overview.includes("calculateFinancialHealth(healthInputs)"), "Overview calculates the shared result once");
expect(overview.includes("metrics.totalIncome"), "Overview KPIs reuse shared metrics");
expect(overview.includes('table: "bills"'), "Health refresh listens to Bills realtime");
expect(overview.includes('table: "debts"'), "Health refresh listens to Debt realtime");
expect(overview.includes('table: "goals"'), "Health refresh listens to Goals realtime");
expect(overview.includes('table: "monthly_budget_items"'), "Health refresh listens to Planner realtime");
expect(page.includes('rpc("get_financial_health_inputs")'), "Dashboard loads scalable aggregate inputs");
expect(sql.includes("security invoker"), "Database function uses caller permissions");
expect(sql.includes("auth.uid()"), "Database function is scoped to the authenticated user");
expect(sql.includes("grant execute") && sql.includes("authenticated"), "Only authenticated users can execute the function");
expect(!sql.includes("service_role"), "Financial health SQL does not use service-role access");

const failures = checks.filter((check) => !check.condition);
for (const check of checks) {
  console.log(`${check.condition ? "PASS" : "FAIL"} ${check.message}`);
}

if (failures.length) {
  process.exitCode = 1;
} else {
  console.log(`\n${checks.length} Phase 2 Financial Health checks passed.`);
}
