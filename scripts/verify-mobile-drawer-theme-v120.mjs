import fs from "node:fs";

const css = fs.readFileSync("components/FiconterNativeAppChrome.module.css", "utf8");
const governance = fs.readFileSync("app/theme-governance.css", "utf8");

const checks = [
  ["V1.20 drawer governance block exists", css.includes("MOBILE UNIFIED V1.20 — THEME-AWARE MORE / ACCOUNT SHEETS")],
  ["drawer uses selected surface card", css.includes("var(--surface-card) 98%")],
  ["drawer border follows theme", css.includes(".drawer {\n  border-color: var(--border-subtle) !important")],
  ["drawer links use semantic raised surface", css.includes("background: var(--surface-raised) !important")],
  ["drawer labels use semantic secondary text", css.includes(".drawerLabel") && css.includes("color: var(--text-secondary) !important")],
  ["drawer icons use current theme accent", css.includes("color: var(--gold) !important")],
  ["active drawer item derives from current accent", css.includes(".drawerLinkActive") && css.includes("color-mix(in srgb, var(--gold) 12%, var(--surface-raised))")],
  ["active icon keeps semantic contrast", css.includes("color: var(--solid-text) !important")],
  ["workspace switch is theme-derived", css.includes("color-mix(in srgb, var(--gold) 9%, var(--surface-subtle))")],
  ["business selector uses theme control background", css.includes("background: var(--control-bg) !important")],
  ["account sheet shares theme-aware drawer", css.includes(".accountSheetClose") && css.includes("var(--surface-subtle) !important")],
  ["danger actions use semantic danger tokens", css.includes("background: var(--danger-soft) !important") && css.includes("color: var(--burgundy) !important")],
  ["global safeguard resets drawer chrome aliases", governance.includes('html[data-ficonter-native-app="true"] [class*="FiconterNativeAppChrome_drawer"]')],
  ["global safeguard maps surface", governance.includes("--mobile-chrome-surface: var(--surface-raised)")],
  ["global safeguard maps foreground", governance.includes("--mobile-chrome-text: var(--text-primary)")],
];

let passed = 0;
for (const [name, ok] of checks) {
  if (ok) {
    passed++;
    console.log(`✓ ${name}`);
  } else {
    console.error(`✗ ${name}`);
  }
}
console.log(`\n${passed}/${checks.length} drawer theme checks passed.`);
if (passed !== checks.length) process.exit(1);
