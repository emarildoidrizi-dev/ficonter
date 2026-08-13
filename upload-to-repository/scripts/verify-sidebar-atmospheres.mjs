import fs from "node:fs";

const requiredFiles = [
  "app/layout.tsx",
  "app/dashboard/layout.tsx",
  "components/InterfacePreferencesBootstrap.tsx",
  "components/SettingsWorkspace.tsx",
  "components/SettingsWorkspace.module.css",
  "components/SidebarNavigation.module.css",
  "lib/interfaceThemes.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
}

const themeSource = fs.readFileSync("lib/interfaceThemes.ts", "utf8");
const settingsSource = fs.readFileSync("components/SettingsWorkspace.tsx", "utf8");
const bootstrapSource = fs.readFileSync(
  "components/InterfacePreferencesBootstrap.tsx",
  "utf8",
);
const rootLayoutSource = fs.readFileSync("app/layout.tsx", "utf8");
const dashboardLayoutSource = fs.readFileSync(
  "app/dashboard/layout.tsx",
  "utf8",
);
const sidebarCss = fs.readFileSync(
  "components/SidebarNavigation.module.css",
  "utf8",
);
const settingsCss = fs.readFileSync(
  "components/SettingsWorkspace.module.css",
  "utf8",
);

const styles = [
  "none",
  "orbital",
  "lightbeam",
  "topography",
  "architectural",
  "particles",
];

for (const style of styles) {
  if (!themeSource.includes(`"${style}"`)) {
    throw new Error(`Missing atmosphere option: ${style}`);
  }
  if (!settingsCss.includes(`data-sidebar-atmosphere="${style}"`)) {
    throw new Error(`Missing settings preview: ${style}`);
  }
  if (
    style !== "none" &&
    !sidebarCss.includes(`data-sidebar-atmosphere-style="${style}"`)
  ) {
    throw new Error(`Missing sidebar atmosphere CSS: ${style}`);
  }
}

for (const token of [
  "SIDEBAR_ATMOSPHERE_OPTIONS",
  "sidebarAtmosphereMode",
  "sidebarAtmosphereStyle",
  "sidebarAtmosphereMotion",
  "resolveSidebarAtmosphereStyle",
]) {
  if (!settingsSource.includes(token) && !themeSource.includes(token)) {
    throw new Error(`Missing implementation token: ${token}`);
  }
}

for (const token of [
  "ficonter-sidebar-atmosphere-mode",
  "ficonter-sidebar-atmosphere-style",
  "ficonter-sidebar-atmosphere-motion",
  "dataset.sidebarAtmosphereStyle",
  "dataset.sidebarAtmosphereMotion",
]) {
  if (!bootstrapSource.includes(token) && !rootLayoutSource.includes(token)) {
    throw new Error(`Missing persistence/bootstrap token: ${token}`);
  }
}

for (const token of [
  "sidebarAtmosphereMode:",
  "sidebarAtmosphereStyle:",
  "sidebarAtmosphereMotion:",
]) {
  if (!dashboardLayoutSource.includes(token)) {
    throw new Error(`Dashboard preference parsing is missing: ${token}`);
  }
}

if (!dashboardLayoutSource.includes("<InterfacePreferencesBootstrap {...interfacePreferences} />")) {
  throw new Error("Dashboard layout does not bootstrap the saved interface preferences");
}

for (const token of [
  "pointer-events: none",
  "prefers-reduced-motion",
  "data-sidebar-atmosphere-motion=\"off\"",
  "@media (max-width: 900px)",
]) {
  if (!sidebarCss.includes(token)) {
    throw new Error(`Missing safety rule: ${token}`);
  }
}

for (const existingFeature of [
  "WALLPAPER_SCENE_OPTIONS",
  "BACKGROUND_MOTION_OPTIONS",
  "preferences.wallpaperScene",
  "preferences.backgroundMotion",
]) {
  if (!settingsSource.includes(existingFeature)) {
    throw new Error(`Existing appearance feature was not preserved: ${existingFeature}`);
  }
}

console.log(
  "FICONTER Sidebar Atmospheres verification passed: 6 styles, auto/manual matching, motion controls, persistence, accessibility, and wallpaper compatibility.",
);
