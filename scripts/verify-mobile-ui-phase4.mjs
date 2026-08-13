import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const layout = read("app/layout.tsx");
const css = read("app/mobile-module-layouts.css");

expect(layout.includes('import "./mobile-module-layouts.css";'), "Phase 4 mobile module stylesheet is not loaded.");
expect(css.includes('html[data-ficonter-native-app="true"]'), "Phase 4 rules must be scoped to mobile app mode.");
expect(css.includes("--mobile-content-max"), "Mobile content width system is missing.");
expect(css.includes("CoastalOverview_cardGrid"), "Overview mobile layout is missing.");
expect(css.includes("TransactionLedger_summary"), "Transactions summary carousel is missing.");
expect(css.includes("TransactionLedger_listViewport"), "Transactions nested scrolling fix is missing.");
expect(css.includes("MonthlyPlanner_topGrid"), "Monthly Planner mobile stack is missing.");
expect(css.includes("MonthlyPlanner_monthlyBudgetForm"), "Monthly budget mobile form is missing.");
expect(css.includes("BillsManager_billList"), "Bills mobile layout is missing.");
expect(css.includes("CreditCardsManager_cardGrid"), "Credit Cards mobile layout is missing.");
expect(css.includes("DebtManager_debtGrid"), "Debt mobile layout is missing.");
expect(css.includes("GoalsManager_grid"), "Goals mobile layout is missing.");
expect(css.includes("SavingsIntelligence_metricGrid"), "Savings mobile metrics are missing.");
expect(css.includes("CashFlowIntelligence_metricGrid"), "Cash Flow mobile metrics are missing.");
expect(css.includes("NetWorthLive_cards"), "Net Worth mobile metrics are missing.");
expect(css.includes("FinancialGps_journey"), "Financial GPS mobile journey is missing.");
expect(css.includes("SettingsWorkspace_navigation"), "Settings mobile navigation is missing.");
expect(css.includes("BusinessSales_summaryGrid"), "Business Sales mobile layout is missing.");
expect(css.includes("BusinessManager_businessGrid"), "Business Manager mobile layout is missing.");
expect(css.includes("BusinessReports_twoColumn"), "Business Reports mobile layout is missing.");
expect(css.includes("@media (max-width: 430px)"), "Narrow-phone adaptation is missing.");
expect(css.includes("@media (min-width: 700px)"), "Tablet adaptation is missing.");
expect(css.includes("scroll-snap-type: x mandatory"), "Touch-friendly horizontal metric rails are missing.");
expect(css.includes("max-height: calc(92dvh"), "Mobile bottom-sheet modal sizing is missing.");

const unscopedRule = css
  .split(/\n(?=[^\s@])/)
  .some((chunk) => chunk.trim().startsWith(".") && !chunk.trim().startsWith("/*"));
expect(!unscopedRule, "Found an unscoped class rule that could affect desktop.");

console.log("FICONTER mobile UI Phase 4: 25 module-layout checks passed.");
