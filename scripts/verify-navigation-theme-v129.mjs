import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const check = (name, condition) => checks.push({ name, condition: Boolean(condition) });

const layout = read("app/layout.tsx");
const speed = read("components/NavigationSpeedBoost.tsx");
const sidebar = read("components/Sidebar.tsx");
const businessSidebar = read("components/BusinessSidebar.tsx");
const guard = read("components/ThemeContrastGuard.tsx");
const visibility = read("app/theme-visibility-v129.css");
const globals = read("app/globals.css");
const coastal = read("app/coastal-shell.css");
const palettes = read("app/theme-palettes.css");
const serviceWorker = read("public/sw.js");

check(
  "V1.29 visibility layer loads after global theme governance",
  layout.indexOf('import "./theme-visibility-v129.css";') > layout.indexOf('import "./theme-governance.css";'),
);
check(
  "Navigation warms critical routes before interaction",
  speed.includes("criticalRoutes.forEach") && speed.includes("router.prefetch(route)"),
);
check(
  "Secondary modules are warmed during browser idle time",
  speed.includes("requestIdleCallback") && speed.includes("secondaryRoutes.forEach"),
);
check(
  "Background prefetch respects data saver and slow networks",
  speed.includes("connection?.saveData") && speed.includes('"slow-2g", "2g"'),
);
check(
  "Instant routes do not flash a loading bar",
  speed.includes("ROUTE_LOADING_DELAY_MS = 140") && speed.includes("loadingDelayTimer"),
);
check(
  "Personal desktop links allow Next.js route prefetch",
  !sidebar.includes("prefetch={false}"),
);
check(
  "Business desktop links allow Next.js route prefetch",
  !businessSidebar.includes("prefetch={false}"),
);
check(
  "Runtime contrast guard also protects phone/tablet content",
  !guard.includes('if (root.dataset.ficonterNativeApp === "true") return'),
);
check(
  "Contrast guard no longer rescans on every character mutation",
  !guard.includes("characterData: true") && guard.includes("record.addedNodes"),
);
check(
  "Theme changes trigger a full contrast re-audit",
  guard.includes('"data-theme"') && guard.includes('"data-resolved-theme"') && guard.includes("scheduleFullAudit"),
);
check(
  "Banners, bars, cards, panels and drawers inherit readable theme foreground",
  ["banner", "bar", "card", "panel", "drawer"].every((token) => visibility.includes(`[class*="${token}" i]`)),
);
check(
  "Financial values and numbers use the primary theme foreground",
  ["amount", "balance", "total", "number"].every((token) => visibility.includes(`[class*="${token}" i]`)),
);
check(
  "Menus and dialogs receive theme-aware opaque-enough surfaces",
  visibility.includes('[role="menu"]') && visibility.includes('[role="dialog"]') && visibility.includes("background-color: color-mix"),
);
check(
  "Inputs, placeholders and select options follow semantic theme colors",
  visibility.includes(":where(input, select, textarea)") && visibility.includes("::placeholder") && visibility.includes("select option"),
);
check(
  "Interactive icons inherit the foreground of their controls",
  visibility.includes("svg:not([data-ficonter-preserve-color=\"true\"])") && visibility.includes("color: currentColor"),
);
check(
  "Base light theme secondary/faint text tokens were strengthened",
  globals.includes("--text-secondary: #6e6a64;") && globals.includes("--text-tertiary: #716c65;"),
);
check(
  "Coastal light theme faint text meets the strengthened visibility baseline",
  coastal.includes("--text-tertiary: #566a63;"),
);
check(
  "Ocean and Sandstone faint text use strengthened palette values",
  palettes.includes("--text-tertiary: #596f76;") && palettes.includes("--text-tertiary: #6f6156;"),
);
check(
  "PWA cache generation is bumped so installed apps receive V1.29 assets",
  serviceWorker.includes("ficonter-pwa-static-v8-nav-theme-v129"),
);

for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"}  ${item.name}`);
}
const failed = checks.filter((item) => !item.condition);
if (failed.length) {
  console.error(`\n${failed.length} V1.29 navigation/theme check(s) failed.`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} FICONTER V1.29 navigation and theme checks passed.`);
