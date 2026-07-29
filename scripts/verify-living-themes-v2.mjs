import fs from "node:fs";

const required = [
  "app/layout.tsx",
  "app/dashboard/layout.tsx",
  "app/living-themes.css",
  "components/LivingThemeBackdrop.tsx",
  "components/InterfacePreferencesBootstrap.tsx",
  "components/SettingsWorkspace.tsx",
  "lib/interfaceThemes.ts",
];

for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
}

const css = fs.readFileSync("app/living-themes.css", "utf8");
for (const token of [
  "data-background-motion=\"animated\"",
  "data-background-motion=\"static\"",
  "data-background-motion=\"off\"",
  "living-theme-orb-one",
  "living-theme-ribbon-one",
  "prefers-reduced-motion",
  "html[data-theme=\"midnight\"]",
  "html[data-theme=\"emerald\"]",
  "html[data-theme=\"bordeaux\"]",
  "html[data-theme=\"ocean\"]",
  "html[data-theme=\"sandstone\"]",
]) {
  if (!css.includes(token)) throw new Error(`Missing CSS token: ${token}`);
}

const dashboardLayout = fs.readFileSync("app/dashboard/layout.tsx", "utf8");
if (!dashboardLayout.includes("<LivingThemeBackdrop />")) {
  throw new Error("Dashboard layout does not render LivingThemeBackdrop");
}

console.log("Living Themes v2 verification passed.");
