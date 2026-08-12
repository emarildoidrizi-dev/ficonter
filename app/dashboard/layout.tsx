import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { RealtimeRefreshBridge } from "@/components/RealtimeRefreshBridge";
import { InterfacePreferencesBootstrap } from "@/components/InterfacePreferencesBootstrap";
import { AuthenticatedLanguageBootstrap } from "@/components/AuthenticatedLanguageBootstrap";
import { BaseCurrencyBootstrap } from "@/components/BaseCurrencyBootstrap";
import { CurrencyDisplayProvider } from "@/components/CurrencyDisplayProvider";
import { LivingThemeBackdrop } from "@/components/LivingThemeBackdrop";
import { CommandPalette } from "@/components/CommandPalette";
import { FiconterNativeAppChrome } from "@/components/FiconterNativeAppChrome";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { PWAMobileDock } from "@/components/PWAMobileDock";
import { MobileNavigationController } from "@/components/MobileNavigationController";
import { NavigationSpeedBoost } from "@/components/NavigationSpeedBoost";
import { requireAdmin } from "@/lib/admin/access";
import { getCurrentUser } from "@/lib/auth/currentUser";
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
  const [{ user, admin }, { supabase }] = await Promise.all([
    requireAdmin(),
    getCurrentUser(),
  ]);
  if (!user) redirect("/login");

  const [{ data: profile }, subscriptionAccess] = await Promise.all([
    supabase
      .from("profiles")
      .select("base_currency")
      .eq("id", user.id)
      .maybeSingle(),
    getCurrentSubscriptionAccess(),
  ]);
  const subscriptionPlanCode = getEffectiveSubscriptionPlanCode(subscriptionAccess);

  const interfacePreferences = readInterfacePreferences(
    user.user_metadata,
  );

  const baseCurrency = profile?.base_currency ?? "EUR";

  return (
    <CurrencyDisplayProvider
      workspace="personal"
      baseCurrency={baseCurrency}
      reportingCurrency="EUR"
    >
    <div className="app-shell">
      <InterfacePreferencesBootstrap {...interfacePreferences} />
      <AuthenticatedLanguageBootstrap language={interfacePreferences.language} />
      <BaseCurrencyBootstrap
        workspace="personal"
        currency={baseCurrency}
      />
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
          avatarPath: String(
            user.user_metadata?.avatar_path ?? "",
          ),
        }}
      />
      <main className="app-main">
        <WorkspaceSwitcher current="personal" subscriptionPlanCode={subscriptionPlanCode} />
        {children}
      </main>
          <PWAMobileDock workspace="personal" />
      </div>
    </CurrencyDisplayProvider>
  );
}
