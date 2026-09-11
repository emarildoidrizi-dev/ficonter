import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { BusinessSidebar } from "@/components/BusinessSidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { FiconterNativeAppChrome } from "@/components/FiconterNativeAppChrome";
import { NavigationSpeedBoost } from "@/components/NavigationSpeedBoost";
import { OwnerMusicPlayer } from "@/components/OwnerMusicPlayer";
import { PlatformTransparencyNotice } from "@/components/PlatformTransparencyNotice";
import { RealtimeRefreshBridge } from "@/components/RealtimeRefreshBridge";
import { RuntimeStabilityBridge } from "@/components/RuntimeStabilityBridge";
import { UsageHeartbeat } from "@/components/UsageHeartbeat";
import { VaultNavigationMount } from "@/components/VaultNavigationMount";
import { VaultProvider } from "@/components/VaultProvider";
import { BusinessVaultProvider } from "@/components/BusinessVaultProvider";
import { CurrencyDisplayProvider } from "@/components/CurrencyDisplayProvider";
import { LivingThemeBackdrop } from "@/components/LivingThemeBackdrop";
import { AuthenticatedThemeSync } from "@/components/AuthenticatedThemeSync";
import { InterfacePreferencesBootstrap } from "@/components/InterfacePreferencesBootstrap";
import { isOwnerEmail, requireAdmin } from "@/lib/admin/access";
import { getBusinessContext } from "@/lib/business/server";
import {
  getCurrentSubscriptionAccess,
  getEffectiveSubscriptionPlanCode,
} from "@/lib/subscriptionAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessLayout({ children }: { children: ReactNode }) {
  const { user, businesses, business, membership } = await getBusinessContext();
  if (!user) redirect("/login");

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
  const stored =
    user.user_metadata?.ficonter_preferences &&
    typeof user.user_metadata.ficonter_preferences === "object"
      ? (user.user_metadata.ficonter_preferences as Record<string, unknown>)
      : {};
  const interfacePreferences = {
    appearance: typeof stored.appearance === "string" ? stored.appearance : undefined,
    density: typeof stored.density === "string" ? stored.density : undefined,
    backgroundMotion:
      typeof stored.backgroundMotion === "string" ? stored.backgroundMotion : undefined,
    wallpaperScene:
      typeof stored.wallpaperScene === "string" ? stored.wallpaperScene : undefined,
    surfaceOpacity:
      typeof stored.surfaceOpacity === "number" || typeof stored.surfaceOpacity === "string"
        ? stored.surfaceOpacity
        : undefined,
  };

  return (
    <CurrencyDisplayProvider
      workspace="business"
      baseCurrency={business?.base_currency ?? "EUR"}
    >
      <div
        className="app-shell business-shell"
        data-auth-theme-pending="true"
        style={{ visibility: "hidden" }}
      >
        <AuthenticatedThemeSync {...interfacePreferences} />
        <InterfacePreferencesBootstrap
          {...interfacePreferences}
          wallpaperAccessEnabled={canManageWallpapers}
        />
        <PlatformTransparencyNotice scope="app" />
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
        <VaultProvider>
          <VaultNavigationMount workspace="business" />
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
            <BusinessVaultProvider
              userId={user.id}
              businessId={business?.id ?? null}
              baseCurrency={business?.base_currency ?? "EUR"}
              canManage={canManageBusiness}
              canWrite={canWriteBusiness}
            >
              {children}
            </BusinessVaultProvider>
          </main>
        </VaultProvider>
      </div>
    </CurrencyDisplayProvider>
  );
}
