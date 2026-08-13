import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "app/layout.tsx",
  "app/dashboard/layout.tsx",
  "app/globals.css",
  "components/DashboardLiveOverview.tsx",
  "components/DashboardLiveOverview.module.css",
  "components/InterfacePreferencesBootstrap.tsx",
  "components/SettingsWorkspace.tsx",
  "components/SettingsWorkspace.module.css",
  "components/HorizonCommandStrip.tsx",
  "components/HorizonCommandStrip.module.css",
  "components/HorizonOverviewBoard.tsx",
  "components/HorizonOverviewBoard.module.css",
  "components/FinancialJourneyRail.tsx",
  "components/FinancialJourneyRail.module.css",
  "components/CommandPalette.tsx",
  "components/CommandPalette.module.css",
  "lib/commandPalette.ts",
  "lib/interfaceLayout.ts",
];

let checks = 0;
function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}

for (const relative of required) {
  const file = path.join(root, relative);
  assert(fs.existsSync(file), `Missing ${relative}`);
  const source = fs.readFileSync(file, "utf8");
  assert(!source.includes("Placeholder artifact"), `${relative} still contains placeholder content`);
  assert(source.trim().length > 80, `${relative} appears incomplete`);
}

const overview = fs.readFileSync(path.join(root, "components/DashboardLiveOverview.tsx"), "utf8");
assert(overview.includes("HorizonCommandStrip"), "Overview is missing the command strip");
assert(overview.includes("HorizonOverviewBoard"), "Overview is missing the Horizon board");
assert(overview.includes("FinancialJourneyRail"), "Overview is missing the journey rail");
assert(overview.includes("calculateFinancialGps"), "Overview is not using the shared Financial GPS calculation");

const settings = fs.readFileSync(path.join(root, "components/SettingsWorkspace.tsx"), "utf8");
assert(settings.includes("Dashboard layout"), "Settings does not expose the layout selector");
assert(settings.includes('layout: "horizon"'), "Horizon is not the default layout preference");

const layout = fs.readFileSync(path.join(root, "app/dashboard/layout.tsx"), "utf8");
assert(layout.includes("<CommandPalette />"), "Command palette is not mounted in the dashboard");
assert(layout.includes("<InterfacePreferencesBootstrap {...interfacePreferences} />") && layout.includes("layout:"), "Saved layout is not bootstrapped");

const commands = fs.readFileSync(path.join(root, "lib/commandPalette.ts"), "utf8");
assert((commands.match(/id: "/g) ?? []).length >= 15, "Command palette contains too few actions");

console.log(`FICONTER Horizon Layout verification passed: ${checks} checks.`);
