import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

const settings = read("components/SettingsWorkspace.tsx");
const settingsPage = read("app/dashboard/settings/page.tsx");
const dashboardLayout = read("app/dashboard/layout.tsx");
const businessLayout = read("app/business/layout.tsx");
const bootstrap = read("components/InterfacePreferencesBootstrap.tsx");
const plans = read("lib/subscriptionPlans.ts");
const access = read("lib/admin/access.ts");

const checks = [
  [settings.includes("canManageWallpapers?: boolean"), "SettingsWorkspace exposes wallpaper role gate"],
  [settings.includes("{canManageWallpapers ? ("), "Wallpaper controls are conditionally rendered"],
  [settings.includes('data-owner-wallpaper-controls="true"'), "Wallpaper owner-only marker is present"],
  [settings.includes("Owner / Super Admin only"), "Wallpaper UI identifies its governance"],
  [settingsPage.includes('admin?.role === "super_admin"'), "Settings derives wallpaper access from Super Admin role"],
  [settingsPage.includes("canManageWallpapers={canManageWallpapers}"), "Settings passes wallpaper permission explicitly"],
  [dashboardLayout.includes('admin?.role === "super_admin"'), "Personal layout gates wallpapers by role"],
  [businessLayout.includes('admin?.role === "super_admin"'), "Business layout gates wallpapers by role"],
  [dashboardLayout.includes("wallpaperAccessEnabled={canManageWallpapers}"), "Personal bootstrap receives wallpaper gate"],
  [businessLayout.includes("wallpaperAccessEnabled={canManageWallpapers}"), "Business bootstrap receives wallpaper gate"],
  [dashboardLayout.includes("enabled={canManageWallpapers}"), "Personal time-aware wallpaper is role gated"],
  [businessLayout.includes("enabled={canManageWallpapers}"), "Business time-aware wallpaper is role gated"],
  [bootstrap.includes("wallpaperAccessEnabled?: boolean"), "Interface bootstrap supports wallpaper role gate"],
  [bootstrap.includes(': "coastal-island";'), "Unauthorized accounts are pinned to fixed coastal wallpaper"],
  [plans.includes('wallpaper_scenes: {') && plans.includes('minimumPlan: "later"'), "Wallpaper scenes are removed from customer plan entitlement"],
  [plans.includes('time_based_wallpapers: {') && plans.match(/time_based_wallpapers:[\s\S]*?minimumPlan: "later"[\s\S]*?lifecycle: "planned"/), "Time-based wallpapers are removed from customer plan entitlement"],
  [access.includes('if (isOwnerEmail(user.email) || isPrimarySuperAdminEmail(user.email))'), "Owner and primary Super Admin resolve to protected Super Admin access"],
];

for (const [ok, label] of checks) {
  if (!ok) throw new Error(`Wallpaper governance check failed: ${label}`);
}

console.log(`FICONTER wallpaper role governance V1.22 passed (${checks.length}/${checks.length}).`);
