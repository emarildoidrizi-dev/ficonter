import fs from "node:fs";

const required = [
  "app/layout.tsx",
  "app/dashboard/layout.tsx",
  "app/living-themes.css",
  "components/InterfacePreferencesBootstrap.tsx",
  "components/LivingThemeBackdrop.tsx",
  "components/TimeAwareWallpaperBootstrap.tsx",
  "components/SettingsWorkspace.tsx",
  "components/SettingsWorkspace.module.css",
  "lib/daypart.ts",
  "lib/interfaceThemes.ts",
  "lib/subscriptionPlans.ts",
];

for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
}

const scenes = [
  ["coastal-island", "coastal-beach-real.webp"],
  ["ocean-horizon", "ocean-sun-real.webp"],
  ["sand-dunes", "sand-beach-real.webp"],
];

for (const [, filename] of scenes) {
  const asset = `public/wallpapers/${filename}`;
  if (!fs.existsSync(asset)) throw new Error(`Missing wallpaper asset ${asset}`);
}

const themeSource = fs.readFileSync("lib/interfaceThemes.ts", "utf8");
const css = fs.readFileSync("app/living-themes.css", "utf8");
const settings = fs.readFileSync("components/SettingsWorkspace.tsx", "utf8");
const layout = fs.readFileSync("app/dashboard/layout.tsx", "utf8");
const businessLayout = fs.readFileSync("app/business/layout.tsx", "utf8");
const daypart = fs.readFileSync("lib/daypart.ts", "utf8");
const subscriptionPlans = fs.readFileSync("lib/subscriptionPlans.ts", "utf8");
const bootstrap = fs.readFileSync("components/TimeAwareWallpaperBootstrap.tsx", "utf8");

for (const [scene, filename] of scenes) {
  if (!themeSource.includes(`"${scene}"`)) throw new Error(`Missing scene option ${scene}`);
  if (!css.includes(`data-wallpaper-scene="${scene}"`)) throw new Error(`Missing scene CSS ${scene}`);
  if (!css.includes(`/wallpapers/${filename}`)) throw new Error(`Missing scene URL ${scene}`);
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

for (const [period, filename] of [
  ["morning", "time-morning.webp"],
  ["afternoon", "time-afternoon.webp"],
  ["evening", "time-evening.webp"],
]) {
  const asset = `public/wallpapers/${filename}`;
  if (!fs.existsSync(asset)) throw new Error(`Missing scheduled wallpaper ${asset}`);
  if (!css.includes(`data-wallpaper-daypart="${period}"`)) {
    throw new Error(`Missing scheduled CSS for ${period}`);
  }
  if (!css.includes(`/wallpapers/${filename}`)) {
    throw new Error(`Missing scheduled asset URL for ${period}`);
  }
  if (!daypart.includes(`"${period}"`)) {
    throw new Error(`Missing daypart ${period}`);
  }
}

for (const source of [layout, businessLayout]) {
  if (!source.includes("<TimeAwareWallpaperBootstrap")) {
    throw new Error("A workspace is missing TimeAwareWallpaperBootstrap");
  }
  if (!source.includes('admin?.role === "super_admin"') ||
      !source.includes('enabled={canManageWallpapers}')) {
    throw new Error("A workspace is missing the Owner / Super Admin wallpaper role gate");
  }
}

if (!subscriptionPlans.includes("time_based_wallpapers") ||
    !subscriptionPlans.match(/time_based_wallpapers:[\s\S]*?minimumPlan: "later"[\s\S]*?lifecycle: "planned"/)) {
  throw new Error("Time-based wallpapers are still assigned to a customer subscription plan");
}

for (const token of [
  'enabled ? "automatic" : "fixed"',
  'root.dataset.backgroundMotion = "static"',
  'ficonter:daypart-updated',
]) {
  if (!bootstrap.includes(token)) {
    throw new Error(`Missing schedule bootstrap token ${token}`);
  }
}

if (!settings.includes("Smart time-of-day wallpaper") ||
    settings.includes("<legend>Wallpaper motion</legend>") ||
    !settings.includes("canManageWallpapers") ||
    !settings.includes("Owner / Super Admin only")) {
  throw new Error("Appearance settings do not enforce Owner / Super Admin wallpaper governance");
}

if (!css.includes("prefers-reduced-motion")) {
  throw new Error("Reduced motion protection is missing");
}

if (css.includes("coastal-island.svg")) {
  throw new Error("The cartoon coastal wallpaper is still active");
}

console.log("FICONTER photographic wallpaper verification passed (3 legacy real scenes + 3 protected dayparts + fixed customer fallback).");
