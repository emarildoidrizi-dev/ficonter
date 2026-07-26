import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));
const checks = [];

function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
}

const enginePath = "lib/wealth/savingsIntelligence.ts";
const componentPath = "components/SavingsIntelligence.tsx";
const cssPath = "components/SavingsIntelligence.module.css";
const pagePath = "app/dashboard/savings/page.tsx";
const sqlPath = "supabase/phase2_savings_intelligence.sql";
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

check("engine exports normalizer", engine.includes("normalizeSavingsIntelligenceInputs"));
check("engine exports calculator", engine.includes("calculateSavingsIntelligence"));
check("engine reuses Cash Flow calculator", engine.includes("calculateCashFlowIntelligence"));
check("engine reuses Cash Flow inputs", engine.includes("CashFlowIntelligenceInputs"));
check("engine provides saving consistency", engine.includes("consistencyRate"));
check("engine provides recommended target", engine.includes("recommendedMonthlyTarget"));
check("engine provides annual forecast", engine.includes("annualForecast"));
check("engine provides category allocation", engine.includes("SavingsCategory"));
check("engine provides best and weakest months", engine.includes("bestMonth") && engine.includes("weakestMonth"));
check("engine provides transparent next action", engine.includes("nextBestAction"));
check("server page requires authenticated user", page.includes('redirect("/login")'));
check("server page calls aggregate RPC", page.includes('"get_savings_intelligence_inputs"'));
check("component subscribes to transactions", component.includes('table: "transactions"'));
check("component subscribes to bills", component.includes('table: "bills"'));
check("component subscribes to debts", component.includes('table: "debts"'));
check("component subscribes to planner", component.includes('table: "monthly_budget_items"'));
check("component renders 12-month trend", component.includes("Saving momentum"));
check("component renders savings allocation", component.includes("Where savings are going"));
check("component renders recent contributions", component.includes("Latest saving activity"));
check("component discloses shared source of truth", component.includes("same General Saving transactions"));
check("sidebar exposes Savings Intelligence route", sidebar.includes('["/dashboard/savings", PiggyBank, "Savings intelligence"]'));
check("SQL is security invoker", sql.includes("security invoker"));
check("SQL scopes transactions to authenticated user", (sql.match(/user_id = v_user_id/g) ?? []).length >= 3);
check("SQL reuses Cash Flow source", sql.includes("v_cash_flow := public.get_cash_flow_intelligence_inputs()"));
check("SQL adds allocation and recent history only", sql.includes("category_rows") && sql.includes("recent_savings"));
check("SQL preserves goal investment classification", sql.includes("Goal investments"));
check("SQL denies anon execution", sql.includes("revoke all on function public.get_savings_intelligence_inputs() from public, anon"));
check("SQL grants authenticated execution", sql.includes("grant execute on function public.get_savings_intelligence_inputs() to authenticated"));
check("no service-role client added", !component.includes("SUPABASE_SERVICE_ROLE_KEY") && !engine.includes("SUPABASE_SERVICE_ROLE_KEY"));
check("verification script is wired", packageJson.scripts?.["verify:phase2-savings"] === "node scripts/verify-phase2-savings.mjs");
check("verify all includes savings", packageJson.scripts?.["verify:all"]?.includes("verify:phase2-savings"));

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "✓" : "✗"} ${item.name}`);
}

if (failures.length) {
  console.error(`\n${failures.length} Savings Intelligence verification check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} Savings Intelligence architecture checks passed.`);
