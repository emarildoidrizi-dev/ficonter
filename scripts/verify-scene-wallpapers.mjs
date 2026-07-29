import fs from "node:fs";

const required = [
  "app/layout.tsx",
  "app/dashboard/layout.tsx",
  "app/living-themes.css",
  "components/InterfacePreferencesBootstrap.tsx",
  "components/LivingThemeBackdrop.tsx",
  "components/SettingsWorkspace.tsx",
  "components/SettingsWorkspace.module.css",
  "lib/interfaceThemes.ts",
  "lib/interfaceLayout.ts",
];

for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
}

const scenes = [
  "space-nebula",
  "aurora",
  "ocean-horizon",
  "sand-dunes",
  "marble-glow",
  "future-grid",
  "forest-mist",
  "minimal-luxe",
];

for (const scene of scenes) {
  const asset = `public/wallpapers/${scene}.svg`;
  if (!fs.existsSync(asset)) throw new Error(`Missing wallpaper asset ${asset}`);
}

const themeSource = fs.readFileSync("lib/interfaceThemes.ts", "utf8");
const css = fs.readFileSync("app/living-themes.css", "utf8");
const settings = fs.readFileSync("components/SettingsWorkspace.tsx", "utf8");
const layout = fs.readFileSync("app/dashboard/layout.tsx", "utf8");

for (const scene of scenes) {
  if (!themeSource.includes(`"${scene}"`)) throw new Error(`Missing scene option ${scene}`);
  if (!css.includes(`data-wallpaper-scene="${scene}"`)) throw new Error(`Missing scene CSS ${scene}`);
  if (!css.includes(`/wallpapers/${scene}.svg`)) throw new Error(`Missing scene URL ${scene}`);
}

for (const token of [
  "WALLPAPER_SCENE_OPTIONS",
  "BACKGROUND_MOTION_OPTIONS",
  "preferences.wallpaperScene",
  "preferences.backgroundMotion",
  "ficonter-wallpaper-scene",
  "ficonter-background-motion",
]) {
  if (!settings.includes(token) && !themeSource.includes(token)) {
    throw new Error(`Missing implementation token ${token}`);
  }
}

if (!layout.includes("<LivingThemeBackdrop />")) {
  throw new Error("Dashboard layout does not render LivingThemeBackdrop");
}

if (!css.includes("prefers-reduced-motion")) {
  throw new Error("Reduced motion protection is missing");
}

console.log("FICONTER Scene Wallpapers v1 verification passed (8 scenes).");
