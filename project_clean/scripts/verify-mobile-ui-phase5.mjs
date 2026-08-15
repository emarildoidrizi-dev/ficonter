import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const layout = read("app/layout.tsx");
const css = read("app/mobile-comfort.css");
const chrome = read("components/FiconterNativeAppChrome.tsx");

expect(layout.includes('import "./mobile-comfort.css";'), "Phase 5 comfort stylesheet is not loaded.");
expect(css.includes('html[data-ficonter-native-app="true"]'), "Phase 5 rules must be scoped to mobile app mode.");
expect(css.includes("--mobile-touch-target: 48px"), "48px touch-target system is missing.");
expect(css.includes('data-ficonter-keyboard="open"'), "Keyboard-aware layout rules are missing.");
expect(css.includes("--ficonter-visual-viewport-height"), "Visible viewport modal sizing is missing.");
expect(css.includes("scroll-margin-top"), "Focused-control scroll clearance is missing.");
expect(css.includes(":focus-visible"), "Visible keyboard focus treatment is missing.");
expect(css.includes('input[type="checkbox"]'), "Comfort-sized checkbox/radio treatment is missing.");
expect(css.includes('data-ficonter-app-drawer="open"'), "Drawer background scroll lock is missing.");
expect(css.includes("overscroll-behavior-inline: contain"), "Horizontal data-rail scroll containment is missing.");
expect(css.includes("var(--mobile-canvas) 0%"), "Theme-aware full-bleed background correction is missing.");
expect(css.includes("@media (max-width: 360px)"), "Small-phone ergonomics are missing.");
expect(css.includes("@media (orientation: landscape) and (max-height: 620px)"), "Landscape ergonomics are missing.");

expect(chrome.includes("root.dataset.ficonterKeyboard"), "Keyboard state synchronization is missing.");
expect(chrome.includes('"--ficonter-visual-viewport-height"'), "Visual viewport height synchronization is missing.");
expect(chrome.includes("drawerCloseButtonRef"), "Drawer focus entry is missing.");
expect(chrome.includes('event.key !== "Tab"'), "Drawer keyboard focus containment is missing.");
expect(chrome.includes('aria-controls="ficonter-app-drawer"'), "Menu-to-drawer relationship is missing.");
expect(chrome.includes('id="ficonter-app-drawer"'), "Stable drawer id is missing.");
expect(chrome.includes('inert={!drawerOpen}'), "Closed drawer must be removed from the focus order.");

const unscopedRule = css
  .split(/\n(?=[^\s@])/)
  .some((chunk) => chunk.trim().startsWith(".") && !chunk.trim().startsWith("/*"));
expect(!unscopedRule, "Found an unscoped Phase 5 class rule that could affect desktop.");

console.log("FICONTER mobile UI Phase 5: 21 comfort/QA checks passed.");
