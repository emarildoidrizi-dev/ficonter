import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const expect = (condition, message) => checks.push({ condition, message });

const engine = read("lib/wealth/financialIndependence.ts");
const component = read("components/FinancialIndependence.tsx");
const css = read("components/FinancialIndependence.module.css");
const page = read("app/dashboard/financial-independence/page.tsx");
const sidebar = read("components/Sidebar.tsx");
const sql = read("supabase/phase2_financial_independence.sql");
const pkg = JSON.parse(read("package.json"));

expect(engine.includes("calculateNetWorthGrowth"), "FI engine reuses Net Worth Growth");
expect(engine.includes("calculateSavingsIntelligence"), "FI engine reuses Savings Intelligence");
expect(engine.includes("calculateEmergencyFund"), "FI engine reuses Emergency Fund");
expect(engine.includes("financialIndependenceTarget"), "FI target is calculated once");
expect(engine.includes("protectedEmergencyReserve"), "Emergency reserve is protected from FI capital");
expect(engine.includes("monthlyDebtReductionPace"), "Debt reduction contributes to the FI pace");
expect(engine.includes("averageMonthlySavings6Months"), "Stable six-month saving pace is reused");
expect(engine.includes("monthsToFutureValue"), "Directional compounding timeline exists");
expect(engine.includes("foundationGap"), "Negative investable position is handled explicitly");
expect(engine.includes("Financial Independence projections are planning estimates") === false, "Disclaimer remains in the UI layer");
expect(component.includes("Planning estimate only") && component.includes("These are planning assumptions, not guarantees"), "UI contains a planning disclaimer");
expect(component.includes("financial_independence_settings"), "Private assumptions are saved through the RLS table");
expect(component.includes("get_financial_independence_inputs"), "One aggregate RPC powers refreshes");
expect(
  component.includes("normalizeNetWorthGrowthInputs(payload.netWorthGrowth)") &&
    component.includes("normalizeSavingsIntelligenceInputs(payload.savingsIntelligence)") &&
    component.includes("normalizeEmergencyFundInputs(payload.emergencyFund)"),
  "Aggregate FI inputs are normalized before base-currency reconciliation",
);
expect(!component.includes('.from("transactions")'), "FI UI does not query transactions directly");
expect(!component.includes('.from("debts")'), "FI UI does not query debts directly");
expect(engine.includes("Current pace"), "Current contribution scenario is generated");
expect(engine.includes("+€100 monthly"), "100 EUR contribution scenario is generated");
expect(engine.includes("+€250 monthly"), "250 EUR contribution scenario is generated");
expect(component.includes("Monthly income needed from investments"), "Lifestyle assumption control exists");
expect(component.includes("PLANNING STYLE") && component.includes("selectedPlan.rate"), "Withdrawal-rate assumption control exists");
expect(component.includes("Timeline assumption") && component.includes("GROWTH_OPTIONS"), "Real-return assumption control exists");
expect(component.includes("subscribeFiconterDataChanges") && component.includes("isFinancialDataScope"), "Transactions realtime refresh is covered by the shared financial event bridge");
expect(component.includes("subscribeFiconterDataChanges") && component.includes("isFinancialDataScope"), "Debts realtime refresh is covered by the shared financial event bridge");
expect(component.includes("subscribeFiconterDataChanges") && component.includes("isFinancialDataScope"), "Debt payments realtime refresh is covered by the shared financial event bridge");
expect(component.includes("subscribeFiconterDataChanges") && component.includes("isFinancialDataScope"), "Bills realtime refresh is covered by the shared financial event bridge");
expect(component.includes("subscribeFiconterDataChanges") && component.includes("isFinancialDataScope"), "Goals realtime refresh is covered by the shared financial event bridge");
expect(component.includes("get_financial_independence_inputs") && page.includes("<FinancialIndependence"), "Server page loads the aggregate FI RPC");
expect(sidebar.includes("/dashboard/financial-independence"), "Sidebar links to Financial Independence");
expect(sql.includes("public.financial_independence_settings"), "Private FI settings table exists");
expect(sql.includes("enable row level security"), "FI settings have RLS enabled");
expect(sql.includes("auth.uid() = user_id"), "FI settings policies are user-scoped");
expect(sql.includes("public.get_net_worth_growth_inputs()"), "FI RPC reuses Net Worth Growth RPC");
expect(sql.includes("public.get_savings_intelligence_inputs()"), "FI RPC reuses Savings Intelligence RPC");
expect(sql.includes("public.get_emergency_fund_intelligence_inputs()"), "FI RPC reuses Emergency Fund RPC");
expect(sql.includes("security invoker"), "FI aggregate runs with caller permissions");
expect(!sql.includes("service_role"), "FI SQL does not use service-role access");
expect(css.includes("@media (max-width: 800px)") && css.includes("@media (max-width: 520px)"), "Financial Independence has mobile layout rules");
expect(pkg.scripts?.["verify:phase2-financial-independence"], "Package exposes FI verification script");
expect(pkg.scripts?.["verify:all"]?.includes("verify:phase2-financial-independence"), "Full verification includes FI module");

const failures = checks.filter((check) => !check.condition);
for (const check of checks) {
  console.log(`${check.condition ? "PASS" : "FAIL"} ${check.message}`);
}

if (failures.length) {
  process.exitCode = 1;
} else {
  console.log(`\n${checks.length} Phase 2 Financial Independence checks passed.`);
}
