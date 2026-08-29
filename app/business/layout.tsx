import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { BusinessSidebar } from "@/components/BusinessSidebar";
import { AuthenticatedLanguageBootstrap } from "@/components/AuthenticatedLanguageBootstrap";
import { BaseCurrencyBootstrap } from "@/components/BaseCurrencyBootstrap";
import { CommandPalette } from "@/components/CommandPalette";
import { FiconterNativeAppChrome } from "@/components/FiconterNativeAppChrome";
import { InterfacePreferencesBootstrap } from "@/components/InterfacePreferencesBootstrap";
import { NavigationSpeedBoost } from "@/components/NavigationSpeedBoost";
import { OwnerMusicPlayer } from "@/components/OwnerMusicPlayer";
import { RealtimeRefreshBridge } from "@/components/RealtimeRefreshBridge";
import { RuntimeStabilityBridge } from "@/components/RuntimeStabilityBridge";
import { TimeAwareWallpaperBootstrap } from "@/components/TimeAwareWallpaperBootstrap";
import { UsageHeartbeat } from "@/components/UsageHeartbeat";
import { VaultAccessPanel } from "@/components/VaultAccessPanel";
import { VaultProvider } from "@/components/VaultProvider";
import { BusinessVaultProvider } from "@/components/BusinessVaultProvider";
import { CurrencyDisplayProvider } from "@/components/CurrencyDisplayProvider";
import { LivingThemeBackdrop } from "@/components/LivingThemeBackdrop";
import { isOwnerEmail, requireAdmin } from "@/lib/admin/access";
import { getBusinessContext } from "@/lib/business/server";
import {
  getCurrentSubscriptionAccess,
  getEffectiveSubscriptionPlanCode,
} from "@/lib/subscriptionAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StoredPreferences = {
  appearance?: string;
  density?: string;
  backgroundMotion?: string;
  wallpaperScene?: string;
  surfaceOpacity?: number;
  language?: string;
};

function readInterfacePreferences(metadata: unknown): StoredPreferences {
  if (!metadata || typeof metadata !== "object") return {};
  const preferences = (metadata as Record<string, unknown>).ficonter_preferences;
  if (!preferences || typeof preferences !== "object") return {};
  const value = preferences as Record<string, unknown>;
  return {
    appearance: typeof value.appearance === "string" ? value.appearance : undefined,
    density: typeof value.density === "string" ? value.density : undefined,
    backgroundMotion:
      typeof value.backgroundMotion === "string" ? value.backgroundMotion : undefined,
    wallpaperScene:
      typeof value.wallpaperScene === "string" ? value.wallpaperScene : undefined,
    surfaceOpacity:
      typeof value.surfaceOpacity === "number"
        ? value.surfaceOpacity
        : typeof value.surfaceOpacity === "string"
          ? Number(value.surfaceOpacity)
          : undefined,
    language: typeof value.language === "string" ? value.language : undefined,
  };
}

export default async function BusinessLayout({ children }: { children: ReactNode }) {
  const { user, businesses, business, membership } = await getBusinessContext();
  if (!user) redirect("/login?entry=app");

  const [{ admin }, subscriptionAccess] = await Promise.all([
    requireAdmin(),
    getCurrentSubscriptionAccess(),
  ]);
  const isPlatformOwner = isOwnerEmail(user.email);
  const canManageWallpapers = admin?.role === "super_admin";
  const canManageBusiness = Boolean(
    business &&
      (business.owner_id === user.id ||
        membership?.role === "owner" ||
        membership?.role === "admin"),
  );
  const canWriteBusiness = Boolean(
    business &&
      (business.owner_id === user.id ||
        membership?.role === "owner" ||
        membership?.role === "admin" ||
        membership?.role === "member"),
  );
  const subscriptionPlanCode = getEffectiveSubscriptionPlanCode(subscriptionAccess);
  const interfacePreferences = readInterfacePreferences(user.user_metadata);
  const baseCurrency = business?.base_currency ?? "EUR";

  return (
    <CurrencyDisplayProvider
      workspace="business"
      baseCurrency={baseCurrency}
    >
      <div className="app-shell business-shell">
        <InterfacePreferencesBootstrap
          {...interfacePreferences}
          wallpaperAccessEnabled={canManageWallpapers}
        />
        <TimeAwareWallpaperBootstrap enabled={canManageWallpapers} />
        <AuthenticatedLanguageBootstrap language={interfacePreferences.language} />
        <BaseCurrencyBootstrap workspace="business" currency={baseCurrency} />
        <LivingThemeBackdrop />
        <RealtimeRefreshBridge />
        <RuntimeStabilityBridge />
        <UsageHeartbeat workspace="business" />
        <NavigationSpeedBoost
          workspace="business"
          cacheKey={business?.id ?? "none"}
        />
        <CommandPalette />
        {isPlatformOwner ? <OwnerMusicPlayer /> : null}
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
          canManage={canManageBusiness}
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
        <main className="app-main business-interface">
          <VaultProvider>
            <BusinessVaultProvider
              userId={user.id}
              businessId={business?.id ?? null}
              baseCurrency={baseCurrency}
              canManage={canManageBusiness}
              canWrite={canWriteBusiness}
            >
              <VaultAccessPanel />
              {children}
            </BusinessVaultProvider>
          </VaultProvider>
        </main>
      </div>
    </CurrencyDisplayProvider>
  );
}
