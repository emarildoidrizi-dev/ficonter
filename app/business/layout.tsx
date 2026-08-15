import { redirect } from "next/navigation";
import { BusinessSidebar } from "@/components/BusinessSidebar";
import { BetaDomainAccessGate } from "@/components/BetaDomainAccessGate";
import { RealtimeRefreshBridge } from "@/components/RealtimeRefreshBridge";
import { InterfacePreferencesBootstrap } from "@/components/InterfacePreferencesBootstrap";
import { AuthenticatedLanguageBootstrap } from "@/components/AuthenticatedLanguageBootstrap";
import { BaseCurrencyBootstrap } from "@/components/BaseCurrencyBootstrap";
import { CurrencyDisplayProvider } from "@/components/CurrencyDisplayProvider";
import { LivingThemeBackdrop } from "@/components/LivingThemeBackdrop";
import { TimeAwareWallpaperBootstrap } from "@/components/TimeAwareWallpaperBootstrap";
import { CommandPalette } from "@/components/CommandPalette";
import { FiconterNativeAppChrome } from "@/components/FiconterNativeAppChrome";
import { UsageHeartbeat } from "@/components/UsageHeartbeat";
import { NavigationSpeedBoost } from "@/components/NavigationSpeedBoost";
import { getBusinessContext } from "@/lib/business/server";
import { requireAdmin } from "@/lib/admin/access";
import { getCurrentSubscriptionAccess, getEffectiveSubscriptionPlanCode } from "@/lib/subscriptionAccess";
import { shouldShowBetaDomainAccessGate } from "@/lib/betaDomainGate";
import { getSubscriptionUpgradeHref } from "@/lib/subscriptionNavigation";
import { hasSubscriptionFeature } from "@/lib/subscriptionPlans";
import "../business-interface.css";

type StoredPreferences = {
  appearance?: string;
  density?: string;
  backgroundMotion?: string;
  wallpaperScene?: string;
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
    backgroundMotion: get("backgroundMotion"),
    wallpaperScene: get("wallpaperScene"),
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
  // Platform Owner and Super Admin are the only roles allowed to use wallpapers.
  const canManageWallpapers = admin?.role === "super_admin";

  const showBetaGate = await shouldShowBetaDomainAccessGate({
    userId: user.id,
    isAdminExempt: subscriptionAccess.isAdminExempt,
    betaVerified: subscriptionAccess.betaVerified,
  });

  if (showBetaGate) {
    return (
      <BetaDomainAccessGate />
    );
  }

  if (!hasSubscriptionFeature(subscriptionPlanCode, "business_workspace")) {
    redirect(getSubscriptionUpgradeHref("business_workspace"));
  }

  const preferences = readInterfacePreferences(user.user_metadata);

  const workspaceCurrency = business?.base_currency ?? "EUR";

  return (
    <CurrencyDisplayProvider
      workspace="business"
      baseCurrency={workspaceCurrency}
      reportingCurrency={workspaceCurrency}
    >
    <div className="app-shell">
      <InterfacePreferencesBootstrap
        {...preferences}
        wallpaperAccessEnabled={canManageWallpapers}
      />
      <TimeAwareWallpaperBootstrap
        enabled={canManageWallpapers}
      />
      <AuthenticatedLanguageBootstrap language={preferences.language} />
      <BaseCurrencyBootstrap
        workspace="business"
        currency={workspaceCurrency}
      />
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
        isAdmin={Boolean(admin)}
        displayName={String(
          user.user_metadata?.display_name ??
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            "",
        )}
        email={user.email ?? ""}
        avatarPath={String(user.user_metadata?.avatar_path ?? "")}
        businessName={business?.name ?? "Business workspace"}
        activeBusinessId={business?.id ?? null}
        businessProfiles={businesses
          .filter((item) => item.status !== "archived")
          .map((item) => ({ id: item.id, name: item.name }))}
      />
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
      <main className="app-main business-interface">{children}</main>
      </div>
    </CurrencyDisplayProvider>
  );
}
