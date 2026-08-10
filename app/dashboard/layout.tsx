import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { RealtimeRefreshBridge } from "@/components/RealtimeRefreshBridge";
import { InterfacePreferencesBootstrap } from "@/components/InterfacePreferencesBootstrap";
import { AuthenticatedLanguageBootstrap } from "@/components/AuthenticatedLanguageBootstrap";
import { LivingThemeBackdrop } from "@/components/LivingThemeBackdrop";
import { CommandPalette } from "@/components/CommandPalette";
import { FiconterNativeAppChrome } from "@/components/FiconterNativeAppChrome";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { PWAMobileDock } from "@/components/PWAMobileDock";
import { FiconterLayoutShell } from "@/components/FiconterLayoutShell";
import { MobileNavigationController } from "@/components/MobileNavigationController";
import { NavigationSpeedBoost } from "@/components/NavigationSpeedBoost";
import { isOwnerEmail, requireAdmin } from "@/lib/admin/access";
import { normalizeInterfaceLayout } from "@/lib/interfaceLayout";
import { getCurrentSubscriptionAccess, getEffectiveSubscriptionPlanCode } from "@/lib/subscriptionAccess";

type StoredPreferences = {
  appearance?: string;
  density?: string;
  layout?: string;
  backgroundMotion?: string;
  wallpaperScene?: string;
  sidebarAtmosphereMode?: string;
  sidebarAtmosphereStyle?: string;
  sidebarAtmosphereMotion?: string;
  language?: string;
};

function readInterfacePreferences(metadata: unknown): StoredPreferences {
  if (!metadata || typeof metadata !== "object") return {};
  const preferences = (
    metadata as Record<string, unknown>
  ).ficonter_preferences;
  if (!preferences || typeof preferences !== "object") return {};
  const value = preferences as Record<string, unknown>;
  return {
    appearance:
      typeof value.appearance === "string"
        ? value.appearance
        : undefined,
    density:
      typeof value.density === "string"
        ? value.density
        : undefined,
    layout:
      typeof value.layout === "string"
        ? value.layout
        : undefined,
    backgroundMotion:
      typeof value.backgroundMotion === "string"
        ? value.backgroundMotion
        : undefined,
    wallpaperScene:
      typeof value.wallpaperScene === "string"
        ? value.wallpaperScene
        : undefined,
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
    language:
      typeof value.language === "string" ? value.language : undefined,
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, admin } = await requireAdmin();
  if (!user) redirect("/login");

  const subscriptionAccess = await getCurrentSubscriptionAccess();
  const subscriptionPlanCode = getEffectiveSubscriptionPlanCode(subscriptionAccess);

  const interfacePreferences = readInterfacePreferences(
    user.user_metadata,
  );

  const allowInternalLayouts = isOwnerEmail(user.email);
  const initialLayout = normalizeInterfaceLayout(interfacePreferences.layout);

  return (
    <>
      <InterfacePreferencesBootstrap
        {...interfacePreferences}
        allowInternalLayouts={allowInternalLayouts}
      />
      <AuthenticatedLanguageBootstrap language={interfacePreferences.language} />
      <LivingThemeBackdrop />
      <RealtimeRefreshBridge />
      <NavigationSpeedBoost
        workspace="personal"
        cacheKey={user.id}
      />
      <CommandPalette />
      <FiconterNativeAppChrome
        workspace="personal"
        subscriptionPlanCode={subscriptionPlanCode}
        displayName={String(
          user.user_metadata?.display_name ??
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            "",
        )}
      />
      <MobileNavigationController workspace="personal" />
      <FiconterLayoutShell
        initialLayout={initialLayout}
        allowInternalLayouts={allowInternalLayouts}
        workspace="personal"
        sidebar={
          <Sidebar
            isAdmin={Boolean(admin)}
            subscriptionPlanCode={subscriptionPlanCode}
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
        }
        workspaceSwitcher={
          <WorkspaceSwitcher
            current="personal"
            subscriptionPlanCode={subscriptionPlanCode}
          />
        }
        mobileDock={<PWAMobileDock workspace="personal" />}
      >
        {children}
      </FiconterLayoutShell>
    </>
  );

}
