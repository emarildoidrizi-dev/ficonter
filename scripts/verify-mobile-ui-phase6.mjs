import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const layout = read("app/layout.tsx");
const visual = read("app/mobile-shell-v2.css");
const comfort = read("app/mobile-comfort.css");
const chrome = read("components/FiconterNativeAppChrome.tsx");
const chromeCss = read("components/FiconterNativeAppChrome.module.css");

expect(layout.includes('import "./mobile-shell-v2.css";'), "Shell V2 stylesheet is not loaded.");
expect(layout.indexOf("mobile-shell-v2.css") > layout.indexOf("mobile-comfort.css"), "Shell V2 must load after the ergonomic layer.");
expect(visual.includes('html[data-ficonter-native-app="true"]'), "Visual system must stay mobile-scoped.");
expect(visual.includes("--mobile-ui-radius"), "Unified mobile radius tokens are missing.");
expect(visual.includes("--mobile-page-title-size: 27px"), "Mobile type scale is missing.");
expect(visual.includes("var(--mobile-canvas)"), "Visual layer must remain theme-aware.");
expect(visual.includes("var(--mobile-text-primary)"), "Visual layer must use semantic text tokens.");
expect(visual.includes('[class*="TransactionLedger_row"]'), "Transaction row treatment is missing.");
expect(visual.includes('[class*="MonthlyPlanner_monthlyBudgetCard"]'), "Planner treatment is missing.");
expect(visual.includes('[class*="SettingsWorkspace_panel"]'), "Settings treatment is missing.");
expect(visual.includes('[class*="BusinessOverview_shell"]'), "Business workspace treatment is missing.");
expect(visual.includes("@media (max-width: 360px)"), "Small-phone design is missing.");
expect(visual.includes("@media (orientation: landscape) and (max-height: 620px)"), "Landscape design is missing.");
expect(visual.includes('html[data-ficonter-device="tablet"]'), "Tablet design is missing.");

expect(chrome.includes('src="/ficonter-mark.svg"'), "Original FICONTER website emblem is missing from the mobile shell.");
expect(chrome.includes("sheetHandle"), "Bottom-sheet navigation handle is missing.");
expect(chrome.includes("drawerLinkStatus"), "Navigation tile status treatment is missing.");
expect(chrome.includes("switchTargetHref"), "Fast workspace switching must remain connected.");
expect(chrome.includes("businessProfileBar"), "Business profile switching must remain available.");
expect(chromeCss.includes("translate3d(0, 105%, 0)"), "Navigation menu must enter as a bottom sheet.");
expect(chromeCss.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"), "Phone menu must use compact two-column navigation tiles.");
expect(chromeCss.includes("right: 0;\n  bottom: 0;\n  left: 0;"), "Bottom navigation must be edge anchored.");
expect(chromeCss.includes("border-radius: 50%"), "Primary add action must be a clear circular thumb target.");
expect(chromeCss.includes("prefers-reduced-motion"), "Reduced-motion support is missing.");
expect(comfort.includes("Shell V2 owns geometry"), "Comfort layer still owns obsolete shell geometry.");

console.log("FICONTER mobile UI Phase 6: 25 current full-shell/UI checks passed.");
