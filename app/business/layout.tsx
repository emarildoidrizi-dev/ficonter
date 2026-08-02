import { redirect } from "next/navigation";
import { BusinessSidebar } from "@/components/BusinessSidebar";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { RealtimeRefreshBridge } from "@/components/RealtimeRefreshBridge";
import { InterfacePreferencesBootstrap } from "@/components/InterfacePreferencesBootstrap";
import { LivingThemeBackdrop } from "@/components/LivingThemeBackdrop";
import { CommandPalette } from "@/components/CommandPalette";
import { getBusinessContext } from "@/lib/business/server";

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
  const get = (key: string) =>
    typeof value[key] === "string" ? (value[key] as string) : undefined;

  return {
    appearance: get("appearance"),
    density: get("density"),
    layout: get("layout"),
    backgroundMotion: get("backgroundMotion"),
    wallpaperScene: get("wallpaperScene"),
    sidebarAtmosphereMode: get("sidebarAtmosphereMode"),
    sidebarAtmosphereStyle: get("sidebarAtmosphereStyle"),
    sidebarAtmosphereMotion: get("sidebarAtmosphereMotion"),
  };
}

export default async function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, businesses, business } = await getBusinessContext();
  if (!user) redirect("/login");

  const preferences = readInterfacePreferences(user.user_metadata);

  return (
    <div className="app-shell">
      <InterfacePreferencesBootstrap {...preferences} />
      <LivingThemeBackdrop />
      <RealtimeRefreshBridge />
      <CommandPalette />
      <BusinessSidebar
        businesses={businesses}
        business={business}
        user={{
          displayName: String(
            user.user_metadata?.display_name ??
              user.user_metadata?.full_name ??
              user.user_metadata?.name ??
              "",
          ),
          email: user.email ?? "",
        }}
      />
      <main className="app-main">
        <WorkspaceSwitcher current="business" />
        {children}
      </main>
    </div>
  );
}
