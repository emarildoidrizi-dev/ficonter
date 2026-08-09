import { redirect } from "next/navigation";
import { BusinessSidebar } from "@/components/BusinessSidebar";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { PWAMobileDock } from "@/components/PWAMobileDock";
import { MobileNavigationController } from "@/components/MobileNavigationController";
import { RealtimeRefreshBridge } from "@/components/RealtimeRefreshBridge";
import { InterfacePreferencesBootstrap } from "@/components/InterfacePreferencesBootstrap";
import { AuthenticatedLanguageBootstrap } from "@/components/AuthenticatedLanguageBootstrap";
import { LivingThemeBackdrop } from "@/components/LivingThemeBackdrop";
import { CommandPalette } from "@/components/CommandPalette";
import { FiconterNativeAppChrome } from "@/components/FiconterNativeAppChrome";
import { UsageHeartbeat } from "@/components/UsageHeartbeat";
import { NavigationSpeedBoost } from "@/components/NavigationSpeedBoost";
import { getBusinessContext } from "@/lib/business/server";
import { requireAdmin } from "@/lib/admin/access";
import { getCurrentSubscriptionAccess, getEffectiveSubscriptionPlanCode } from "@/lib/subscriptionAccess";
import { getSubscriptionUpgradeHref } from "@/lib/subscriptionNavigation";
import { hasSubscriptionFeature } from "@/lib/subscriptionPlans";

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
  const get = (key: string) =>
    typeof value[key] === "string"
      ? (value[key] as string)
      : undefined;

  return {
    appearance: get("appearance"),
    density: get("density"),
    layout: get("layout"),
    backgroundMotion: get("backgroundMotion"),
    wallpaperScene: get("wallpaperScene"),
    sidebarAtmosphereMode: get("sidebarAtmosphereMode"),
    sidebarAtmosphereStyle: get("sidebarAtmosphereStyle"),
    sidebarAtmosphereMotion: get("sidebarAtmosphereMotion"),
    language: get("language"),
  };
}

export default async function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [
    { user, businesses, business, membership },
    { admin },
  ] = await Promise.all([
    getBusinessContext(),
    requireAdmin(),
  ]);

  if (!user) redirect("/login");

  const subscriptionAccess = await getCurrentSubscriptionAccess();
  const subscriptionPlanCode = getEffectiveSubscriptionPlanCode(subscriptionAccess);

  if (!hasSubscriptionFeature(subscriptionPlanCode, "business_workspace")) {
    redirect(getSubscriptionUpgradeHref("business_workspace"));
  }

  const preferences = readInterfacePreferences(user.user_metadata);

  return (
    <div className="app-shell">
      <InterfacePreferencesBootstrap {...preferences} />
      <AuthenticatedLanguageBootstrap language={preferences.language} />
      <LivingThemeBackdrop />
      <RealtimeRefreshBridge />
      <UsageHeartbeat workspace="business" />
      <NavigationSpeedBoost
        workspace="business"
        cacheKey={business?.id ?? "none"}
      />
      <CommandPalette />
      <FiconterNativeAppChrome
        workspace="business"
        subscriptionPlanCode={subscriptionPlanCode}
        displayName={String(
          user.user_metadata?.display_name ??
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            "",
        )}
        businessName={business?.name ?? "Business workspace"}
      />
            <MobileNavigationController workspace="business" />
      <BusinessSidebar
        businesses={businesses}
        business={business}
        canManage={
          membership?.role === "owner" ||
          membership?.role === "admin"
        }
        isPlatformAdmin={Boolean(admin)}
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
        <WorkspaceSwitcher current="business" subscriptionPlanCode={subscriptionPlanCode} />
        {children}
      </main>
          <PWAMobileDock workspace="business" />
      </div>
  );
}
