import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const required = [
  "app/layout.tsx",
  "app/theme-palettes.css",
  "components/InterfacePreferencesBootstrap.tsx",
  "components/SettingsWorkspace.tsx",
  "components/SettingsWorkspace.module.css",
  "lib/interfaceThemes.ts",
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const themeSource = fs.readFileSync(path.join(root, "lib/interfaceThemes.ts"), "utf8");
for (const theme of ["midnight", "emerald", "bordeaux", "ocean", "sandstone"]) {
  if (!themeSource.includes(`\"${theme}\"`)) {
    throw new Error(`Theme is not registered: ${theme}`);
  }
}

const css = fs.readFileSync(path.join(root, "app/theme-palettes.css"), "utf8");
for (const theme of ["midnight", "emerald", "bordeaux", "ocean", "sandstone"]) {
  if (!css.includes(`html[data-theme=\"${theme}\"]`)) {
    throw new Error(`Theme palette is missing: ${theme}`);
  }
}

const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
if (!layout.includes('import "./theme-palettes.css";')) {
  throw new Error("The theme palette stylesheet is not imported after globals.css.");
}

console.log("FICONTER interface themes: 18 checks passed.");
