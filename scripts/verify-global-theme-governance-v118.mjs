import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const layout = read("app/layout.tsx");
const governance = read("app/theme-governance.css");
const coastal = read("app/coastal-shell.css");
const chrome = read("components/FiconterNativeAppChrome.module.css");
const personalHeader = read("components/SidebarNavigation.module.css");
const businessHeader = read("components/BusinessSidebar.module.css");
const settingsCss = read("components/SettingsWorkspace.module.css");
const themes = read("lib/interfaceThemes.ts");

const governanceImport = layout.indexOf('import "./theme-governance.css";');
const mobileStackImport = layout.indexOf('import "./mobile-page-stack.css";');
expect(governanceImport > mobileStackImport && mobileStackImport >= 0, "Global theme governance must load after all mobile presentation layers.");

expect(governance.includes("--mobile-chrome-bg: var(--surface-card)"), "Mobile chrome must inherit the selected theme surface.");
expect(governance.includes("--mobile-chrome-text: var(--text-primary)"), "Mobile chrome text must inherit selected-theme foreground.");
expect(governance.includes("--fui-text: var(--text-primary)"), "Unified mobile text must inherit selected-theme foreground.");
expect(governance.includes("--fui-surface-solid: var(--surface-card)"), "Unified mobile surfaces must inherit selected-theme cards.");
expect(governance.includes("select option"), "Select option surfaces must be themed globally.");
expect(governance.includes("::placeholder"), "Input placeholders must adapt with the selected theme.");
expect(governance.includes("color: currentColor"), "Interactive SVG icons must inherit their readable control foreground.");

expect(coastal.includes('html[data-theme="light"] .app-shell'), "Coastal palette must be scoped to the Light appearance.");
expect(coastal.includes('html[data-theme="system"][data-resolved-theme="light"] .app-shell'), "System Light must retain the coastal palette.");
expect(!coastal.includes('html[data-resolved-theme="light"] .app-shell {'), "Ocean and Sandstone must not be overwritten by a generic resolved-light coastal rule.");

expect(chrome.includes("MOBILE UNIFIED V1.18 — THEME-AWARE CHROME GOVERNANCE"), "Bottom navigation must use the new theme-aware chrome block.");
expect(chrome.includes("background: color-mix(in srgb, var(--surface-raised) 94%, transparent) !important"), "Bottom navigation surface must be selected-theme aware.");
expect(chrome.includes("color: var(--text-secondary) !important"), "Bottom navigation inactive text must adapt to the theme.");
expect(chrome.includes("color: var(--gold) !important"), "Bottom navigation active icons must use the selected theme accent.");

for (const source of [personalHeader, businessHeader]) {
  expect(source.includes("background:color-mix(in srgb,var(--surface-raised)"), "Top header controls must use semantic theme surfaces.");
  expect(source.includes("color:var(--text-primary)"), "Top header controls must use semantic theme text.");
  expect(source.includes("border:1px solid var(--border-subtle)"), "Top header controls must use semantic theme borders.");
}

expect(settingsCss.includes("color:var(--gold)"), "Settings accents must use the theme accent token.");
expect(settingsCss.includes("background:var(--success-soft)"), "Settings success states must use semantic theme tokens.");
expect(settingsCss.includes("background:var(--danger-soft)"), "Settings danger states must use semantic theme tokens.");

for (const theme of ["light", "dark", "system", "midnight", "emerald", "bordeaux", "ocean", "sandstone"]) {
  expect(themes.includes(`"${theme}"`), `Appearance option missing: ${theme}`);
}

console.log("FICONTER global theme governance V1.18: 26 checks passed.");
