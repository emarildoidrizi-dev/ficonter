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
const migration = read("supabase/migrations/20260813170000_monthly_spending_budget.sql");

expect(planner, "spending_budget", "Monthly Planner must load and save a dedicated spending budget.");
expect(planner, "saveMonthlyBudget", "Monthly Planner must provide an explicit budget save action.");
expect(planner, "Spent so far", "Monthly Planner must display the synchronized spent amount.");
expect(planner, "budgetUsedPercent", "Monthly Planner must calculate real budget usage.");
expect(planner, "notifyFiconterDataChange(\"planner\")", "Saving a budget must notify live financial surfaces.");
expect(overviewPage, '.select("month,spending_budget")', "Overview must load the dedicated budget source.");
expect(overview, "initialBudgetPlans.find", "Overview must select the current month's dedicated budget.");
expect(overview, "spendingAmount / spendingBudget", "Overview must calculate usage from real spending and budget values.");
expect(migration, "check (spending_budget >= 0)", "The database must reject negative monthly budgets.");

if (overview.includes("const spendingBudget = Math.max(0, financialHealthInputs.planner.plannedOutflow)")) {
  throw new Error("Overview still infers the budget from category plans instead of the dedicated monthly value.");
}

console.log("FICONTER synchronized monthly spending budget verification passed: 9 checks.");
