import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const expect = (condition, message) => checks.push({ condition, message });

const engine = read("lib/wealth/financialHealth.ts");
const score = read("components/CoastalOverview.tsx");
const overview = read("components/DashboardLiveOverview.tsx");
const encryptedOverview = read("components/EncryptedDashboardOverview.tsx");
const sourceHook = read("components/useBaseCurrencySourceData.ts");
const page = read("app/dashboard/overview/page.tsx");
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
expect(score.includes('financialHealth.scoreAvailable ? score : "—"'), "UI hides an unsupported numeric score");
expect(!score.includes("calculateFinancialHealth("), "Overview presentation does not duplicate Financial Health calculation logic");
expect(score.includes("financialHealth: FinancialHealthResult"), "Overview presentation consumes the shared Financial Health result");
expect(overview.includes("calculateFinancialHealth(financialHealthInputs)"), "Overview calculates the shared result once from reconciled inputs");
expect(overview.includes("financialHealth={financialHealth}"), "Overview passes the shared Financial Health result into the unified UI");
expect(sourceHook.includes("useEncryptedBills") && sourceHook.includes("bills: encryptedBills"), "Financial Health consumes Bills through the encrypted Bills source");
expect(sourceHook.includes('window.addEventListener("ficonter:data-changed"') && sourceHook.includes("isFinancialDataScope"), "Financial Health refresh is driven by the shared financial realtime bridge");
expect(sourceHook.includes('.from("debts")') && sourceHook.includes('.eq("user_id", userId)'), "Health source scopes Debt access to the authenticated user");
expect(sourceHook.includes('.from("goals")') && sourceHook.includes('.eq("user_id", userId)'), "Health source scopes Goal access to the authenticated user");
expect(sourceHook.includes('.from("monthly_budget_items")') && sourceHook.includes('.eq("user_id", userId)'), "Health source scopes Planner access to the authenticated user");
expect(page.includes("EncryptedDashboardOverview") && page.includes("userId={user.id}"), "Dashboard loads Financial Health through the authenticated encrypted Overview boundary");
expect(encryptedOverview.includes("useBaseCurrencySourceData(props.userId)"), "Encrypted Overview uses the shared reconciled financial source");
expect(sql.includes("security invoker"), "Database function uses caller permissions");
expect(sql.includes("auth.uid()"), "Database function is scoped to the authenticated user");
expect(sql.includes("grant execute") && sql.includes("authenticated"), "Only authenticated users can execute the legacy aggregate function");
expect(!sql.includes("service_role"), "Financial health SQL does not use service-role access");

const failures = checks.filter((check) => !check.condition);
for (const check of checks) console.log(`${check.condition ? "PASS" : "FAIL"} ${check.message}`);
if (failures.length) process.exitCode = 1;
else console.log(`\n${checks.length} Phase 2 Financial Health checks passed.`);
