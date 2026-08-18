import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { VaultProvider } from "@/components/VaultProvider";
import { VaultAccessPanel } from "@/components/VaultAccessPanel";
import { EncryptedTransactionProvider } from "@/components/EncryptedTransactionProvider";
import { RealtimeRefreshBridge } from "@/components/RealtimeRefreshBridge";
import { InterfacePreferencesBootstrap } from "@/components/InterfacePreferencesBootstrap";
import { AuthenticatedLanguageBootstrap } from "@/components/AuthenticatedLanguageBootstrap";
import { BaseCurrencyBootstrap } from "@/components/BaseCurrencyBootstrap";
import { CurrencyDisplayProvider } from "@/components/CurrencyDisplayProvider";
import { LivingThemeBackdrop } from "@/components/LivingThemeBackdrop";
import { TimeAwareWallpaperBootstrap } from "@/components/TimeAwareWallpaperBootstrap";
import { CommandPalette } from "@/components/CommandPalette";
import { FiconterNativeAppChrome } from "@/components/FiconterNativeAppChrome";
import { NavigationSpeedBoost } from "@/components/NavigationSpeedBoost";
import { RuntimeStabilityBridge } from "@/components/RuntimeStabilityBridge";
import { OwnerMusicPlayer } from "@/components/OwnerMusicPlayer";
import { isOwnerEmail, requireAdmin } from "@/lib/admin/access";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { getCurrentSubscriptionAccess, getEffectiveSubscriptionPlanCode } from "@/lib/subscriptionAccess";

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
    backgroundMotion:
      typeof value.backgroundMotion === "string"
        ? value.backgroundMotion
        : undefined,
    wallpaperScene:
      typeof value.wallpaperScene === "string"
        ? value.wallpaperScene
        : undefined,
    surfaceOpacity:
      typeof value.surfaceOpacity === "number"
        ? value.surfaceOpacity
        : typeof value.surfaceOpacity === "string"
          ? Number(value.surfaceOpacity)
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
  if (!user) redirect("/login?entry=app");

  const [{ data: profile }, subscriptionAccess] = await Promise.all([
    supabase
      .from("profiles")
      .select("base_currency")
      .eq("id", user.id)
      .maybeSingle(),
    getCurrentSubscriptionAccess(),
  ]);
  const subscriptionPlanCode = getEffectiveSubscriptionPlanCode(subscriptionAccess);
  // Owner and Super Admin are the only roles allowed to use wallpaper controls.
  const canManageWallpapers = admin?.role === "super_admin";
  const isPlatformOwner = isOwnerEmail(user.email);

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
      <InterfacePreferencesBootstrap
        {...interfacePreferences}
        wallpaperAccessEnabled={canManageWallpapers}
      />
      <TimeAwareWallpaperBootstrap
        enabled={canManageWallpapers}
      />
      <AuthenticatedLanguageBootstrap language={interfacePreferences.language} />
      <BaseCurrencyBootstrap
        workspace="personal"
        currency={baseCurrency}
      />
      <LivingThemeBackdrop />
      <RealtimeRefreshBridge />
      <RuntimeStabilityBridge />
      <NavigationSpeedBoost
        workspace="personal"
        cacheKey={user.id}
      />
      <CommandPalette />
      {isPlatformOwner ? <OwnerMusicPlayer /> : null}
      <FiconterNativeAppChrome
        workspace="personal"
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
      />
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
        <VaultProvider>
  <EncryptedTransactionProvider>
    <VaultAccessPanel />
    {children}
  </EncryptedTransactionProvider>
</VaultProvider>
      </main>
      </div>
    </CurrencyDisplayProvider>
  );
}
