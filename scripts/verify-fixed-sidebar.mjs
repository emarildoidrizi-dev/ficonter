import fs from "node:fs";

const globalCss = fs.readFileSync("app/globals.css", "utf8");
const sidebarCss = fs.readFileSync("components/SidebarNavigation.module.css", "utf8");
const checks = [
  [globalCss.includes("height: 100dvh"), "viewport-height dashboard shell"],
  [globalCss.includes(".app-main"), "main workspace selector"],
  [globalCss.includes("overflow-y: auto"), "main internal scrolling"],
  [globalCss.includes("overflow: hidden"), "shell overflow containment"],
  [sidebarCss.includes(".sidebarRoot"), "sidebar root containment"],
  [sidebarCss.includes("overscroll-behavior: contain"), "sidebar scroll containment"],
  [sidebarCss.includes("@media (max-width: 900px)"), "mobile reset"],
];
for (const [passed, label] of checks) {
  if (!passed) throw new Error(`Missing: ${label}`);
}
console.log(`Fixed sidebar verification passed: ${checks.length} checks.`);
