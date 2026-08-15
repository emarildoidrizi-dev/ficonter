import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "app/layout.tsx",
  "app/dashboard/layout.tsx",
  "app/globals.css",
  "components/DashboardLiveOverview.tsx",
  "components/CoastalOverview.tsx",
  "components/CoastalOverview.module.css",
  "components/InterfacePreferencesBootstrap.tsx",
  "components/SettingsWorkspace.tsx",
  "components/SettingsWorkspace.module.css",
  "components/CommandPalette.tsx",
  "components/CommandPalette.module.css",
  "lib/commandPalette.ts",
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
assert(overview.includes("CoastalOverview"), "Overview is missing the coastal dashboard");
assert(overview.includes("calculateFinancialGps"), "Overview is not using the shared Financial GPS calculation");
assert(!overview.includes("HorizonOverviewBoard"), "The retired Golden Calm board is still rendered");
assert(!overview.includes("classicOnly"), "The retired dashboard branch is still rendered");

const settings = fs.readFileSync(path.join(root, "components/SettingsWorkspace.tsx"), "utf8");
assert(!settings.includes("Dashboard layout"), "Settings still exposes the retired layout selector");
assert(!settings.includes("preferences.layout"), "Settings still stores a selectable dashboard layout");

const layout = fs.readFileSync(path.join(root, "app/dashboard/layout.tsx"), "utf8");
assert(layout.includes("<CommandPalette />"), "Command palette is not mounted in the dashboard");
assert(
  layout.includes("<InterfacePreferencesBootstrap") &&
    layout.includes("{...interfacePreferences}") &&
    layout.includes("wallpaperAccessEnabled={canManageWallpapers}"),
  "Interface preferences are not bootstrapped",
);
assert(!layout.includes("layout:"), "Dashboard layout still reads the retired preference");

const rootLayout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
assert(rootLayout.includes('localStorage.removeItem("ficonter-layout")'), "Legacy browser layout choice is not cleared");
assert(!rootLayout.includes("data-layout"), "Root layout still exposes a selectable layout attribute");

const commands = fs.readFileSync(path.join(root, "lib/commandPalette.ts"), "utf8");
assert((commands.match(/id: "/g) ?? []).length >= 15, "Command palette contains too few actions");

console.log(`FICONTER fixed redesign layout verification passed: ${checks} checks.`);
