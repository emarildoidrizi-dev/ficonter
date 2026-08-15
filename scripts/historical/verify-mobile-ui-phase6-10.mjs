import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const chrome = read("components/FiconterNativeAppChrome.tsx");
const css = read("components/FiconterNativeAppChrome.module.css");
const stack = read("app/mobile-screen-stack.css");

expect(chrome.includes("styles.brandRow"), "Top brand row is missing.");
expect(chrome.includes("styles.brandIdentity"), "Brand identity cluster is missing.");
expect(chrome.includes('src="/ficonter-mark.svg"'), "Original website emblem is missing.");
expect(chrome.includes("Financial Control Center"), "Expanded brand descriptor is missing.");
expect(chrome.includes("styles.contextRow"), "Second context row is missing.");
expect(chrome.includes("styles.routeTitle"), "Current module title is missing from the second row.");
expect(chrome.includes("styles.workspaceLabel"), "Workspace label is missing from the second row.");
expect(chrome.includes("onClick={openDrawer}"), "Menu action is missing from the second row.");
expect(chrome.includes("onClick={navigateBack}"), "Back action is missing for deeper screens.");
expect(chrome.includes("styles.workspaceBadge"), "Profile photo control is missing from the first row.");
expect(css.includes(".brandRow"), "Brand row CSS is missing.");
expect(css.includes(".contextRow"), "Context row CSS is missing.");
expect(css.includes(".brandCopy"), "Compact brand typography CSS is missing.");
expect(css.includes(".workspaceLabel"), "Workspace label CSS is missing.");
expect(css.includes(".brandMenuButton,\n.menuBadge {\n  display: none !important;"), "Old stacked badge composition is not disabled.");
expect(stack.includes("Phase 6.10"), "Two-row header content clearance is missing.");
expect(stack.includes("padding-top: calc(126px + env(safe-area-inset-top))"), "Personal screen clearance does not match the new header.");
expect(stack.includes("padding-top: calc(178px + env(safe-area-inset-top))"), "Business screen clearance does not match the new header.");

console.log("FICONTER mobile UI Phase 6.10: 18 ordered-header checks passed.");
