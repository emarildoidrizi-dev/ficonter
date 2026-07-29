import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const requiredFiles = [
  "app/living-themes.css",
  "components/LivingThemeBackdrop.tsx",
  "components/InterfacePreferencesBootstrap.tsx",
  "components/SettingsWorkspace.tsx",
  "components/SettingsWorkspace.module.css",
  "lib/interfaceThemes.ts",
  "app/layout.tsx",
  "app/dashboard/layout.tsx",
];

let checks = 0;
for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing ${file}`);
  checks += 1;
}

const sources = requiredFiles
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");

for (const marker of [
  "BACKGROUND_MOTION_OPTIONS",
  "normalizeBackgroundMotion",
  "ficonter-background-motion",
  "LivingThemeBackdrop",
  "Subtle motion",
  "Static atmosphere",
  "prefers-reduced-motion",
  'data-theme="midnight"',
  'data-theme="emerald"',
  'data-theme="bordeaux"',
  'data-theme="ocean"',
  'data-theme="sandstone"',
]) {
  if (!sources.includes(marker)) {
    throw new Error(`Missing Living Themes marker: ${marker}`);
  }
  checks += 1;
}

console.log(`Living Themes verification passed: ${checks} checks.`);
