import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));
const checks = [];

function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
}

const enginePath = "lib/wealth/emergencyFund.ts";
const componentPath = "components/EmergencyFundIntelligence.tsx";
const cssPath = "components/EmergencyFundIntelligence.module.css";
const pagePath = "app/dashboard/emergency-fund/page.tsx";
const sqlPath = "supabase/phase2_emergency_fund.sql";
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

check("engine exports normalizer", engine.includes("normalizeEmergencyFundInputs"));
check("engine exports calculator", engine.includes("calculateEmergencyFund"));
check("engine reuses Financial Health calculator", engine.includes("calculateFinancialHealth"));
check("engine reuses Financial Health inputs", engine.includes("FinancialHealthInputs"));
check("engine provides three and six month targets", engine.includes("foundationTarget") && engine.includes("strongTarget"));
check("engine provides sustainable contribution guidance", engine.includes("suggestedMonthlyContribution"));
check("engine provides estimated completion", engine.includes("estimatedCompletionDate"));
check("engine provides milestones", engine.includes("EmergencyFundMilestone"));
check("engine provides transparent next action", engine.includes("nextBestAction"));
check("server page requires authenticated user", page.includes('redirect("/login")'));
check("server page calls aggregate RPC", page.includes('"get_emergency_fund_intelligence_inputs"'));
check("component subscribes to transactions", component.includes('table: "transactions"'));
check("component subscribes to bills", component.includes('table: "bills"'));
check("component discloses no duplicate balance", component.includes("No second\n            balance or duplicate savings calculation is created"));
check("component renders reserve milestones", component.includes("Protection milestones"));
check("component renders 12-month history", component.includes("Last 12 months"));
check("component reuses Transactions workflow", component.includes('href="/dashboard/transactions"'));
check("sidebar exposes Emergency fund route", sidebar.includes('["/dashboard/emergency-fund", Umbrella, "Emergency fund"]'));
check("SQL is security invoker", sql.includes("security invoker"));
check("SQL scopes transactions to authenticated user", (sql.match(/user_id = v_user_id/g) ?? []).length >= 3);
check("SQL reuses Financial Health source", sql.includes("v_health := public.get_financial_health_inputs()"));
check("SQL adds only contribution history", sql.includes("monthly_contributions") && sql.includes("recent_contributions"));
check("SQL denies anon execution", sql.includes("revoke all on function public.get_emergency_fund_intelligence_inputs() from public, anon"));
check("SQL grants authenticated execution", sql.includes("grant execute on function public.get_emergency_fund_intelligence_inputs() to authenticated"));
check("no service-role client added", !component.includes("SUPABASE_SERVICE_ROLE_KEY") && !engine.includes("SUPABASE_SERVICE_ROLE_KEY"));
check("verification script is wired", packageJson.scripts?.["verify:phase2-emergency-fund"] === "node scripts/verify-phase2-emergency-fund.mjs");
check("verify all includes emergency fund", packageJson.scripts?.["verify:all"]?.includes("verify:phase2-emergency-fund"));

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "✓" : "✗"} ${item.name}`);
}

if (failures.length) {
  console.error(`\n${failures.length} Emergency Fund verification check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} Emergency Fund architecture checks passed.`);
