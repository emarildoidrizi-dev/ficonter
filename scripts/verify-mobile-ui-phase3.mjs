import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const chrome = read("components/FiconterNativeAppChrome.tsx");
const chromeCss = read("components/FiconterNativeAppChrome.module.css");
const globals = read("app/globals.css");
const mobile = read("app/native-mobile-app.css");

expect(chrome.includes("personalRouteGroups"), "Personal navigation must be grouped.");
expect(chrome.includes("businessRouteGroups"), "Business navigation must be grouped.");
expect(chrome.includes("drawerGroupLinks"), "Drawer must render grouped links.");
expect(chrome.includes("rootScreen"), "Root/deep mobile screen distinction is missing.");
expect(chrome.includes("headerBrandMark"), "Overview must expose the website emblem in the top-left navigation control.");
expect(chrome.includes("navigateBack"), "Deeper screens must expose deterministic back navigation.");
expect(chrome.includes('event.key === "Escape"'), "Drawer must close with Escape.");
expect(chrome.includes("FICONTER") && chrome.includes("PERSONAL") && chrome.includes("BUSINESS"), "Mobile header must expose a stable FICONTER/workspace eyebrow.");
expect(chromeCss.includes(".drawerGroup"), "Grouped drawer styling is missing.");
expect(chromeCss.includes(".dockActive::after"), "Dock active indicator is missing.");
expect(chromeCss.includes(".brandMenuButton"), "Top-left emblem/menu control styling is missing.");
expect(chromeCss.includes(".backButton"), "Back-button styling is missing.");
expect(chromeCss.includes("prefers-reduced-motion"), "Reduced-motion support is missing.");
expect(chromeCss.includes("var(--mobile-chrome-text)"), "Chrome must use stable semantic chrome tokens.");
expect(!exists("components/MobileNavigationController.tsx"), "Legacy MobileNavigationController still exists.");
expect(!exists("components/MobileNavigationController.module.css"), "Legacy MobileNavigationController CSS still exists.");
expect(!exists("components/PWAMobileDock.tsx"), "Legacy PWAMobileDock still exists.");
expect(!exists("components/PWAMobileDock.module.css"), "Legacy PWAMobileDock CSS still exists.");
expect(!globals.includes("data-ficonter-pwa-phone"), "Dead data-ficonter-pwa-phone CSS still exists in globals.css.");
expect(!mobile.includes("MobileNavigationController"), "Native mobile CSS still references legacy MobileNavigationController.");
expect(!mobile.includes("PWAMobileDock"), "Native mobile CSS still references legacy PWAMobileDock.");

console.log("FICONTER mobile UI Phase 3: 21 current navigation/chrome checks passed.");
