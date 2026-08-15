import { readFileSync } from "node:fs";

const globals = readFileSync("app/globals.css", "utf8");
const settingsCss = readFileSync("components/SettingsWorkspace.module.css", "utf8");
const settingsTsx = readFileSync("components/SettingsWorkspace.tsx", "utf8");

const checks = [
  ["comfortable page padding is materially spacious", globals.includes('--density-page-padding: 48px;')],
  ["compact page padding is materially tight", globals.includes('--density-page-padding: 16px;')],
  ["comfortable cards use larger padding", globals.includes('--density-card-padding: 28px;')],
  ["compact cards use smaller padding", globals.includes('--density-card-padding: 12px;')],
  ["comfortable controls are larger", globals.includes('--density-control-height: 52px;')],
  ["compact controls are smaller", globals.includes('--density-control-height: 36px;')],
  ["density governs generic panels and KPI cards", /\.panel,\s*\n\s*\.card,\s*\n\s*\.kpi/.test(globals)],
  ["comfortable card radius is distinct", globals.includes('--density-card-radius: 22px;')],
  ["compact card radius is distinct", globals.includes('--density-card-radius: 14px;')],
  ["phone/tablet comfortable padding is density-aware", globals.includes('html[data-density="comfortable"] .app-main') && globals.includes('max(18px, env(safe-area-inset-right))')],
  ["phone/tablet compact padding is density-aware", globals.includes('html[data-density="compact"] .app-main') && globals.includes('max(8px, env(safe-area-inset-right))')],
  ["mobile compact controls retain practical touch height", globals.includes('min-height: 42px;')],
  ["Settings comfortable mode is visibly wider", settingsCss.includes('grid-template-columns:320px minmax(0,1fr)')],
  ["Settings compact mode is visibly tighter", settingsCss.includes('grid-template-columns:230px minmax(0,1fr)')],
  ["density preview communicates extra compact content", settingsTsx.includes('<i />\n                      <i />\n                      <i />\n                      <i />')],
  ["density selection remains draft-only", settingsTsx.includes('setPreferences(next);') && settingsTsx.includes('Save appearance')],
  ["density copy explains meaningful compact difference", settingsTsx.includes('substantially more information fits on screen')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`\n${failed}/${checks.length} layout-density checks failed.`);
  process.exit(1);
}

console.log(`\n${checks.length}/${checks.length} FICONTER V1.24 layout-density checks passed.`);
