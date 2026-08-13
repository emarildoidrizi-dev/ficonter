import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const layout = read("app/layout.tsx");
const chrome = read("components/FiconterNativeAppChrome.tsx");
const chromeCss = read("components/FiconterNativeAppChrome.module.css");
const stack = read("app/mobile-screen-stack.css");

expect(layout.includes('import "./mobile-screen-stack.css";'), "Screen-stack stylesheet is not loaded.");
expect(layout.indexOf("mobile-screen-stack.css") > layout.indexOf("mobile-shell-v2.css"), "Screen-stack layer must load after Shell V2.");
expect(chrome.includes('type NavigationDirection = "forward" | "back"'), "Navigation direction model is missing.");
expect(chrome.includes("isRootWorkspaceRoute"), "Root route detection is missing.");
expect(chrome.includes("navigateBack"), "Header back navigation is missing.");
expect(chrome.includes("edgeSwipeStartRef"), "Edge swipe-back tracking is missing.");
expect(chrome.includes("deltaX >= 76"), "Swipe-back threshold is missing.");
expect(chrome.includes("beginNavigationTransition(\"forward\")"), "Forward route transitions are missing.");
expect(chrome.includes("headerBrandMark"), "Top-left website emblem is missing.");
expect(chrome.includes("menuBadge"), "Top-left sidebar affordance is missing.");
expect(chrome.includes("<ArrowLeft"), "Deep-screen back icon is missing.");
expect(chromeCss.includes(".brandMenuButton"), "Emblem/menu styling is missing.");
expect(chromeCss.includes(".backButton"), "Back control styling is missing.");
expect(stack.includes("height: 100dvh !important"), "Bounded app viewport is missing.");
expect(stack.includes("overflow-y: auto !important"), "Module-scoped vertical scrolling is missing.");
expect(stack.includes("ficonter-screen-enter-forward"), "Forward screen animation is missing.");
expect(stack.includes("ficonter-screen-enter-back"), "Backward screen animation is missing.");
expect(stack.includes('[class*="CoastalOverview_cardGrid"]'), "Compact Overview swipe deck is missing.");
expect(stack.includes("scroll-snap-type: x mandatory"), "Horizontal card snap behavior is missing.");
expect(stack.includes("prefers-reduced-motion"), "Reduced-motion handling is missing.");

console.log("FICONTER mobile screen stack: 20 compact-navigation checks passed.");
