import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "app/layout.tsx",
  "app/dashboard/layout.tsx",
  "app/globals.css",
  "app/living-themes.css",
  "app/coastal-shell.css",
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
  "lib/interfaceThemes.ts",
  "public/wallpapers/future-grid.svg",
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
assert(overview.includes("HorizonOverviewBoard"), "Overview is missing the redesign board");
assert(overview.includes("FinancialJourneyRail"), "Overview is missing the journey rail");
assert(overview.includes("calculateFinancialGps"), "Overview is not using the shared Financial GPS calculation");
assert(!overview.includes("classicOnly"), "The retired dashboard branch is still rendered");

const settings = fs.readFileSync(path.join(root, "components/SettingsWorkspace.tsx"), "utf8");
assert(!settings.includes("Dashboard layout"), "Settings still exposes the retired layout selector");
assert(!settings.includes("preferences.layout"), "Settings still stores a selectable dashboard layout");

const layout = fs.readFileSync(path.join(root, "app/dashboard/layout.tsx"), "utf8");
assert(layout.includes("<CommandPalette />"), "Command palette is not mounted in the dashboard");
assert(layout.includes("<InterfacePreferencesBootstrap {...interfacePreferences} />"), "Interface preferences are not bootstrapped");
assert(!layout.includes("layout:"), "Dashboard layout still reads the retired preference");

const rootLayout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
assert(rootLayout.includes('localStorage.removeItem("ficonter-layout")'), "Legacy browser layout choice is not cleared");
assert(!rootLayout.includes("data-layout"), "Root layout still exposes a selectable layout attribute");
assert(rootLayout.includes("FIXED_INTERFACE_PROFILE_VERSION"), "Golden Calm profile migration is not mounted");
assert(rootLayout.includes("DEFAULT_APPEARANCE"), "Root layout does not use the fixed appearance default");
assert(rootLayout.includes("DEFAULT_WALLPAPER_SCENE"), "Root layout does not use the fixed wallpaper default");

const themes = fs.readFileSync(path.join(root, "lib/interfaceThemes.ts"), "utf8");
assert(themes.includes('DEFAULT_APPEARANCE: AppearancePreference = "midnight"'), "Midnight is not the fixed profile default");
assert(themes.includes('DEFAULT_WALLPAPER_SCENE: WallpaperScenePreference = "future-grid"'), "Future Grid is not the fixed profile wallpaper");

const shell = fs.readFileSync(path.join(root, "app/coastal-shell.css"), "utf8");
assert(!shell.includes('html[data-resolved-theme="light"] .app-shell'), "The retired Coastal palette still overrides the fixed shell");

const independence = fs.readFileSync(path.join(root, "components/FinancialIndependence.tsx"), "utf8");
assert(independence.includes("normalizeNetWorthGrowthInputs"), "Financial Independence net-worth normalization is missing");
assert(independence.includes("normalizeSavingsIntelligenceInputs"), "Financial Independence savings normalization is missing");

const commands = fs.readFileSync(path.join(root, "lib/commandPalette.ts"), "utf8");
assert((commands.match(/id: "/g) ?? []).length >= 15, "Command palette contains too few actions");

console.log(`FICONTER fixed redesign layout verification passed: ${checks} checks.`);
