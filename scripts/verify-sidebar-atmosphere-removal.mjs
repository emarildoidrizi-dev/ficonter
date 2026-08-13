import fs from "node:fs";

const settings = fs.readFileSync("components/SettingsWorkspace.tsx", "utf8");
const settingsCss = fs.readFileSync(
  "components/SettingsWorkspace.module.css",
  "utf8",
);
const navigationCss = fs.readFileSync(
  "components/SidebarNavigation.module.css",
  "utf8",
);
const themes = fs.readFileSync("lib/interfaceThemes.ts", "utf8");
const rootLayout = fs.readFileSync("app/layout.tsx", "utf8");
const bootstrap = fs.readFileSync(
  "components/InterfacePreferencesBootstrap.tsx",
  "utf8",
);

const removedTokens = [
  "SIDEBAR_ATMOSPHERE_OPTIONS",
  "Sidebar atmosphere",
  "sidebarAtmosphereGrid",
  "data-sidebar-atmosphere-style",
  "resolveSidebarAtmosphereStyle",
];

for (const token of removedTokens) {
  for (const [label, source] of [
    ["settings", settings],
    ["settings CSS", settingsCss],
    ["navigation CSS", navigationCss],
    ["theme definitions", themes],
  ]) {
    if (source.includes(token)) {
      throw new Error(`Retired sidebar atmosphere token remains in ${label}: ${token}`);
    }
  }
}

for (const legacyKey of [
  "ficonter-sidebar-atmosphere-mode",
  "ficonter-sidebar-atmosphere-style",
  "ficonter-sidebar-atmosphere-motion",
]) {
  if (!rootLayout.includes(`localStorage.removeItem("${legacyKey}")`)) {
    throw new Error(`Root bootstrap does not clear legacy key: ${legacyKey}`);
  }
  if (!bootstrap.includes(`localStorage.removeItem("${legacyKey}")`)) {
    throw new Error(`Authenticated bootstrap does not clear legacy key: ${legacyKey}`);
  }
}

console.log("Sidebar atmosphere removal verification passed.");
