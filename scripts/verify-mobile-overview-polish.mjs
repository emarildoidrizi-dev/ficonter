import fs from "node:fs";

const component = fs.readFileSync("components/CoastalOverview.tsx", "utf8");
const css = fs.readFileSync("components/CoastalOverview.module.css", "utf8");
const shell = fs.readFileSync("app/mobile-shell-v2.css", "utf8");

const checks = [
  ["overview keeps Available before Financial health", component.indexOf("styles.availableCard") < component.indexOf("styles.healthCard")],
  ["Available header has visible icon and chevron affordance", component.includes("styles.availableHeaderIcon") && component.includes("styles.availableHeaderChevron")],
  ["Available header opens account activity", component.includes('href="/dashboard/transactions" aria-label="Open account activity"')],
  ["Financial health uses pulse/activity icon", component.includes("<Activity size={18} />")],
  ["formal editorial type is explicitly defined", css.includes('font-family: Georgia, "Times New Roman", serif')],
  ["mobile overview uses active theme text token", css.includes("color: var(--text-primary)")],
  ["mobile cards use active theme surfaces", css.includes("var(--surface-raised)") && css.includes("var(--surface-card)")],
  ["mobile controls use active solid theme colours", css.includes("var(--solid-bg)") && css.includes("var(--solid-text)")],
  ["overview background follows active living wallpaper", css.includes("var(--living-scene) var(--living-position)")],
  ["mobile overview cards are forced into one ordered column", shell.includes('grid-template-columns: minmax(0, 1fr) !important;') && shell.includes('[class*="CoastalOverview_cardGrid"]')],
  ["overview summary rows are one-column touch targets", shell.includes('[class*="CoastalOverview_miniStats"]') && shell.includes("min-height: 82px !important")],
  ["primary money action remains a large touch target", shell.includes('[class*="CoastalOverview_addMoney"]') && shell.includes("min-height: 54px !important")],
  ["mobile shell no longer hard-codes light overview canvas", shell.includes("background: transparent !important") && !shell.slice(shell.indexOf("PHASE 7 —")).includes("#eef0e8")],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (ok) passed += 1;
}
console.log(`\n${passed}/${checks.length} mobile Overview refinement checks passed.`);
if (passed !== checks.length) process.exit(1);
