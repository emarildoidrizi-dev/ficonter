import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));
const checks = [];

function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
}

const enginePath = "lib/wealth/cashFlowIntelligence.ts";
const componentPath = "components/CashFlowIntelligence.tsx";
const cssPath = "components/CashFlowIntelligence.module.css";
const pagePath = "app/dashboard/cash-flow/page.tsx";
const sqlPath = "supabase/phase2_cash_flow_intelligence.sql";
const sidebarPath = "components/Sidebar.tsx";
const packagePath = "package.json";

for (const file of [enginePath, componentPath, cssPath, pagePath, sqlPath]) {
  check(`exists: ${file}`, exists(file));
}

const engine = read(enginePath);
const component = read(componentPath);
const page = read(pagePath);
const sql = read(sqlPath);
const sidebar = read(sidebarPath);
const packageJson = JSON.parse(read(packagePath));

check("engine exports normalizer", engine.includes("normalizeCashFlowIntelligenceInputs"));
check("engine exports calculator", engine.includes("calculateCashFlowIntelligence"));
check("engine reuses Financial Health calculator", engine.includes("calculateFinancialHealth"));
check("engine provides 30-day forecast", engine.includes("projectedNetCashFlow"));
check("engine provides category pressure", engine.includes("CashFlowCategory"));
check("engine provides known commitments", engine.includes("CashFlowCommitment"));
check("engine provides insight priorities", engine.includes("nextBestAction"));
check("server page requires authenticated user", page.includes('redirect("/login")'));
check("server page calls one aggregate RPC", page.includes('rpc(\n    "get_cash_flow_intelligence_inputs"'));
check("component subscribes to transactions", component.includes('table: "transactions"'));
check("component subscribes to bills", component.includes('table: "bills"'));
check("component subscribes to debts", component.includes('table: "debts"'));
check("component subscribes to planner", component.includes('table: "monthly_budget_items"'));
check("component has forecast methodology disclosure", component.includes("Forecasts are estimates, not bank balances"));
check("component renders 12-month chart", component.includes("Income and outflow trend"));
check("component renders spending pressure", component.includes("Spending pressure"));
check("component renders commitments", component.includes("Known commitments"));
check("sidebar exposes Cash flow route", sidebar.includes('["/dashboard/cash-flow", Activity, "Cash flow"]'));
check("SQL is security invoker", sql.includes("security invoker"));
check("SQL scopes every source by authenticated user", (sql.match(/user_id = v_user_id/g) ?? []).length >= 5);
check("SQL reuses Financial Health source", sql.includes("v_health := public.get_financial_health_inputs()"));
check("SQL denies anon execution", sql.includes("revoke all on function public.get_cash_flow_intelligence_inputs() from public, anon"));
check("SQL grants authenticated execution", sql.includes("grant execute on function public.get_cash_flow_intelligence_inputs() to authenticated"));
check("no service-role client added", !component.includes("SUPABASE_SERVICE_ROLE_KEY") && !engine.includes("SUPABASE_SERVICE_ROLE_KEY"));
check("verification script is wired", packageJson.scripts?.["verify:phase2-cash-flow"] === "node scripts/verify-phase2-cash-flow.mjs");

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "✓" : "✗"} ${item.name}`);
}

if (failures.length) {
  console.error(`\n${failures.length} Cash Flow Intelligence verification check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} Cash Flow Intelligence architecture checks passed.`);
