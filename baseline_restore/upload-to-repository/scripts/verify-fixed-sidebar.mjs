import fs from "node:fs";

const shellCss = fs.readFileSync("app/coastal-shell.css", "utf8");
const navigationCss = fs.readFileSync("components/SidebarNavigation.module.css", "utf8");
const businessCss = fs.readFileSync("components/BusinessSidebar.module.css", "utf8");
const personalSource = fs.readFileSync("components/Sidebar.tsx", "utf8");
const businessSource = fs.readFileSync("components/BusinessSidebar.tsx", "utf8");

const checks = [
  [shellCss.includes("height: 100dvh"), "viewport-height dashboard shell"],
  [shellCss.includes("overflow-y: auto"), "main internal scrolling"],
  [navigationCss.includes(".shellHeader"), "personal compact header"],
  [businessCss.includes(".shellHeader"), "business compact header"],
  [navigationCss.includes(".groupMenu"), "personal grouped navigation"],
  [businessCss.includes(".groupMenu"), "business grouped navigation"],
  [personalSource.includes("<details"), "personal accessible navigation groups"],
  [businessSource.includes("<details"), "business accessible navigation groups"],
  [navigationCss.includes("@media (max-width: 900px)"), "personal mobile reset"],
  [businessCss.includes("@media(max-width:900px)"), "business mobile reset"],
];

for (const [passed, label] of checks) {
  if (!passed) throw new Error(`Missing: ${label}`);
}

console.log(`Coastal compact navigation verification passed: ${checks.length} checks.`);
