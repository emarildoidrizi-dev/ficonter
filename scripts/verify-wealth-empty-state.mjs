import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const check = (name, condition) => checks.push({ name, ok: Boolean(condition) });

const health = read("lib/wealth/financialHealth.ts");
const cash = read("lib/wealth/cashFlowIntelligence.ts");
const emergency = read("lib/wealth/emergencyFund.ts");
const savings = read("lib/wealth/savingsIntelligence.ts");
const wealth = read("lib/wealth/wealthScore.ts");
const growth = read("lib/wealth/netWorthGrowth.ts");
const independence = read("lib/wealth/financialIndependence.ts");
const savingsUi = read("components/SavingsIntelligence.tsx");
const keyboard = read("components/KeyboardInteractionBridge.tsx");
const rootLayout = read("app/layout.tsx");

check("Financial Health has a zero-data Not assessed state", health.includes('"Not assessed"') && health.includes("assessed") && health.includes("No data"));
check("Financial Health does not award debt points without debt records", health.includes("let debtPoints = 0") && health.includes("if (hasDebts && debts.activeCount === 0)"));
check("Financial Health does not award bill, goal or planner points without records", health.includes("const overduePoints = hasBills") && health.includes("const goalPoints = hasGoals") && health.includes("const planningPoints = hasPlannerData"));
check("Cash Flow has explicit forecast availability and no-data label", cash.includes("forecastAvailable") && cash.includes('"Not enough data"') && cash.includes('return "No data"'));
check("Emergency Fund confidence can report No data", emergency.includes('| "No data"') && emergency.includes('return "No data"'));
check("Savings Intelligence coverage remains zero without saving records", savings.includes("hasSavingsData") && savings.includes("const dataCoverage = hasSavingsData"));
check("Savings target line is hidden when the target is zero", savingsUi.includes("result.metrics.recommendedMonthlyTarget > 0 ?"));
check("Wealth Score has an unassessed zero-data state", wealth.includes('"Not assessed"') && wealth.includes("assessed: hasAnyData") && wealth.includes("? 0"));
check("Net Worth Growth requires real comparable history", growth.includes('"Not enough history"') && growth.includes("hasHistory") && growth.includes("const dataCoverage = hasHistory"));
check("Financial Independence has an unassessed zero-data state", independence.includes('"Not assessed"') && independence.includes("assessed") && independence.includes('return "No data"'));
check("Global keyboard bridge is mounted", rootLayout.includes("KeyboardInteractionBridge") && keyboard.includes("data-enter-confirm"));
check("Keyboard bridge protects multiline inputs and duplicate native submissions", keyboard.includes("HTMLTextAreaElement") && keyboard.includes("form.requestSubmit()") && keyboard.includes("event.defaultPrevented"));

const confirmationFiles = [
  "components/TransactionLedger.tsx",
  "components/BillsManager.tsx",
  "components/GoalsManager.tsx",
  "components/DebtManager.tsx",
  "components/AdminDashboard.tsx",
  "components/SettingsWorkspace.tsx",
];
const confirmationMarkers = confirmationFiles.reduce(
  (total, file) => total + (read(file).match(/data-enter-confirm="true"/g) ?? []).length,
  0,
);
check("Primary confirmation dialogs expose Enter confirmation markers", confirmationMarkers >= 9);

for (const item of checks) {
  console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}`);
}

const failures = checks.filter((item) => !item.ok);
if (failures.length) process.exit(1);
console.log(`\n${checks.length} empty-state and keyboard checks passed.`);
