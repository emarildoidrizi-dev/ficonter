import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { RealtimeRefreshBridge } from "@/components/RealtimeRefreshBridge";
import { InterfacePreferencesBootstrap } from "@/components/InterfacePreferencesBootstrap";
import { LivingThemeBackdrop } from "@/components/LivingThemeBackdrop";
import { CommandPalette } from "@/components/CommandPalette";
import { requireAdmin } from "@/lib/admin/access";

type StoredPreferences = {
  appearance?: string;
  density?: string;
  layout?: string;
  backgroundMotion?: string;
  wallpaperScene?: string;
  sidebarAtmosphereMode?: string;
  sidebarAtmosphereStyle?: string;
  sidebarAtmosphereMotion?: string;
};

function readInterfacePreferences(metadata: unknown): StoredPreferences {
  if (!metadata || typeof metadata !== "object") return {};
  const preferences = (metadata as Record<string, unknown>).ficonter_preferences;
  if (!preferences || typeof preferences !== "object") return {};

  const value = preferences as Record<string, unknown>;
  return {
    appearance:
      typeof value.appearance === "string" ? value.appearance : undefined,
    density: typeof value.density === "string" ? value.density : undefined,
    layout: typeof value.layout === "string" ? value.layout : undefined,
    backgroundMotion:
      typeof value.backgroundMotion === "string"
        ? value.backgroundMotion
        : undefined,
    wallpaperScene:
      typeof value.wallpaperScene === "string" ? value.wallpaperScene : undefined,
    sidebarAtmosphereMode:
      typeof value.sidebarAtmosphereMode === "string"
        ? value.sidebarAtmosphereMode
        : undefined,
    sidebarAtmosphereStyle:
      typeof value.sidebarAtmosphereStyle === "string"
        ? value.sidebarAtmosphereStyle
        : undefined,
    sidebarAtmosphereMotion:
      typeof value.sidebarAtmosphereMotion === "string"
        ? value.sidebarAtmosphereMotion
        : undefined,
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, admin } = await requireAdmin();

  if (!user) redirect("/login");

  const interfacePreferences = readInterfacePreferences(user.user_metadata);

  return (
    <div className="app-shell">
      <InterfacePreferencesBootstrap
        appearance={interfacePreferences.appearance}
        density={interfacePreferences.density}
        layout={interfacePreferences.layout}
        backgroundMotion={interfacePreferences.backgroundMotion}
        wallpaperScene={interfacePreferences.wallpaperScene}
        sidebarAtmosphereMode={interfacePreferences.sidebarAtmosphereMode}
        sidebarAtmosphereStyle={interfacePreferences.sidebarAtmosphereStyle}
        sidebarAtmosphereMotion={interfacePreferences.sidebarAtmosphereMotion}
      />
      <LivingThemeBackdrop />
      <RealtimeRefreshBridge />
      <CommandPalette />
      <Sidebar
        isAdmin={Boolean(admin)}
        user={{
          displayName: String(
            user.user_metadata?.display_name ??
              user.user_metadata?.full_name ??
              user.user_metadata?.name ??
              "",
          ),
          email: user.email ?? "",
          avatarPath: String(user.user_metadata?.avatar_path ?? ""),
        }}
      />
      <main className="app-main">{children}</main>
    </div>
  );
}
