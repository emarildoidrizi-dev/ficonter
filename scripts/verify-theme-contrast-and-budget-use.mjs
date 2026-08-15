import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function read(file) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) throw new Error(`Missing required file: ${file}`);
  return fs.readFileSync(target, "utf8");
}

function expect(source, fragment, message) {
  if (!source.includes(fragment)) throw new Error(message);
}

const contrastGuard = read("components/ThemeContrastGuard.tsx");
const dashboard = read("components/DashboardLiveOverview.tsx");
const overview = read("components/CoastalOverview.tsx");
const overviewCss = read("components/CoastalOverview.module.css");
const businessCss = read("components/BusinessOverview.module.css");
const coastalShell = read("app/coastal-shell.css");
const planner = read("components/MonthlyPlanner.tsx");
const plannerCss = read("components/MonthlyPlanner.module.css");

expect(contrastGuard, "const MIN_CONTRAST = 4.5", "The global text guard must enforce WCAG AA contrast.");
expect(contrastGuard, "backgroundImageColors", "The global text guard must account for gradient surfaces.");
expect(contrastGuard, "data-resolved-theme", "The contrast repair must react to resolved themes.");
expect(dashboard, ": null;", "A missing budget must use an explicit indeterminate state, not 0%.");
expect(dashboard, "Math.max(0, (spendingAmount / spendingBudget) * 100)", "Budget use must preserve ratios above 100%.");
expect(overview, "Monthly budget use", "The budget-use card needs a self-explanatory title.");
expect(overview, "No monthly budget set", "The no-budget state must explain why no percentage is shown.");
expect(overview, 'href="/dashboard/budget"', "The no-budget state must link to budget setup.");
expect(coastalShell, "--text-secondary: #536963", "The fixed coastal theme must keep supporting text above 4.5:1 contrast.");

for (const token of ["--surface-card", "--text-primary", "--text-secondary", "--border-subtle"]) {
  expect(overviewCss, `var(${token})`, `The Personal overview must use the shared ${token} token.`);
  expect(businessCss, `var(${token})`, `The Business overview must use the shared ${token} token.`);
}
expect(overviewCss, "var(--surface-raised)", "The Personal overview must theme its raised inner surfaces.");

expect(planner, "cardHeaderMetric", "Monthly Planner section headers must use the compact metric header.");
expect(planner, "Actual</span>", "Monthly Planner section headers must surface the actual total.");
expect(plannerCss, "--planner-section-accent", "Monthly Planner section headers must use restrained category accents.");
expect(plannerCss, "var(--surface-raised", "Monthly Planner section headers must inherit the active theme surface.");
expect(plannerCss, "var(--text-primary", "Monthly Planner section header text and amounts must inherit readable theme foregrounds.");
if (/\.card\s*\{[^}]*rgba\(247,\s*243,\s*225/s.test(overviewCss)) {
  throw new Error("The Personal overview still contains the old light-only card surface.");
}

console.log("FICONTER theme contrast and monthly budget use: 23 checks passed.");
