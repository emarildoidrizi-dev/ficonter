import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cssPath = path.join(root, "app/theme-typography-v133.css");
const layoutPath = path.join(root, "app/layout.tsx");
const swPath = path.join(root, "public/sw.js");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS - ${message}`);
}

expect(fs.existsSync(cssPath), "theme typography stylesheet exists");
const css = read(cssPath);
const layout = read(layoutPath);
const sw = read(swPath);

expect(
  layout.includes('import "./theme-typography-v133.css";'),
  "theme typography stylesheet is loaded globally",
);

for (const theme of ["light", "dark", "midnight", "emerald", "bordeaux", "ocean", "sandstone"]) {
  expect(css.includes(`data-theme="${theme}"`), `${theme} has an explicit typography profile`);
}

expect(
  css.includes('data-theme="system"][data-resolved-theme="light"]') &&
    css.includes('data-theme="system"][data-resolved-theme="dark"]'),
  "system theme typography follows the resolved light/dark theme",
);
expect(css.includes("--font-interface:"), "interface font token is defined");
expect(css.includes("--font-display:"), "display font token is defined");
expect(css.includes("--font-numeric:"), "numeric font token is defined");
expect(css.includes("var(--font-interface)"), "controls and body consume the interface font token");
expect(css.includes("var(--font-display)"), "headings consume the display font token");
expect(css.includes("var(--font-numeric)"), "financial figures consume the numeric font token");
expect(css.includes("tabular-nums"), "financial figures retain tabular numeric alignment");
expect(
  !css.includes("transition-property: font-family") && !css.includes("transition: font"),
  "font family is not delayed by an animation",
);
expect(
  !css.includes("data-typography-theme"),
  "typography uses the existing theme source of truth instead of a second state",
);
expect(
  sw.includes("theme-typography-v133"),
  "PWA cache is versioned for the typography release",
);

console.log("FICONTER V1.33 theme-synchronised typography verification passed.");
