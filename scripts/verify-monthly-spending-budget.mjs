import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const expect = (source, fragment, message) => {
  if (!source.includes(fragment)) throw new Error(message);
};

const planner = read("components/MonthlyPlanner.tsx");
const overview = read("components/DashboardLiveOverview.tsx");
const overviewPage = read("app/dashboard/overview/page.tsx");
const encryptedOverview = read("components/EncryptedDashboardOverview.tsx");
const migration = read("supabase/migrations/20260813170000_monthly_spending_budget.sql");

expect(planner, "spending_budget", "Monthly Planner must load and save a dedicated spending budget.");
expect(planner, "saveMonthlyBudget", "Monthly Planner must provide an explicit budget save action.");
expect(planner, "Expenses so far", "Monthly Planner must display expense-only budget usage.");
expect(planner, "monthlyBudgetExpenses", "Monthly Planner budget must use Expenses only.");
expect(planner, "expenseTransactions.filter(isMonthlyBudgetExpenseTransaction)", "Monthly Planner must exclude non-budget financial movements.");
expect(planner, "budgetUsedPercent", "Monthly Planner must calculate real budget usage.");
expect(planner, "notifyFiconterDataChange(\"planner\")", "Saving a budget must notify live financial surfaces.");
if (!overviewPage.includes("EncryptedDashboardOverview") || !encryptedOverview.includes("useBaseCurrencySourceData") || !encryptedOverview.includes("source.plans")) {
  throw new Error("Overview must load the dedicated budget source through the encrypted financial source layer.");
}
expect(overview, "initialBudgetPlans.find", "Overview must select the current month's dedicated budget.");
expect(overview, "monthlyBudgetExpenseTotals", "Overview budget must use expense-only totals.");
expect(overview, "spendingAmount / spendingBudget", "Overview must calculate usage from real expense spending and budget values.");
expect(migration, "check (spending_budget >= 0)", "The database must reject negative monthly budgets.");

if (overview.includes("const spendingBudget = Math.max(0, financialHealthInputs.planner.plannedOutflow)")) {
  throw new Error("Overview still infers the budget from category plans instead of the dedicated monthly value.");
}

console.log("FICONTER expense-only monthly spending budget verification passed: 12 checks.");
