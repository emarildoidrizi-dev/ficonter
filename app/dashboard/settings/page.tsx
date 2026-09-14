import { redirect } from "next/navigation";

import { CustomerSubscriptionManager } from "@/components/CustomerSubscriptionManager";
import { InstalledPwaSettingsWorkspace } from "@/components/InstalledPwaSettingsWorkspace";
import { SettingsSupplementalModules } from "@/components/SettingsSupplementalModules";
import { isOwnerEmail, requireAdmin } from "@/lib/admin/access";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { isSubscriptionFeatureKey } from "@/lib/subscriptionNavigation";
import {
  getCurrentSubscriptionAccess,
  getEffectiveSubscriptionPlanCode,
} from "@/lib/subscriptionAccess";
import styles from "./SettingsPage.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SettingsPageProps = {
  searchParams?: Promise<{
    section?: string | string[];
    required?: string | string[];
  }>;
};

type SubscriptionSnapshot = {
  plan_code?: string | null;
  status?: string | null;
  billing_interval?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  provider?: string | null;
};

type ProfileSnapshot = {
  base_currency?: string | null;
};

function hasPaidCancellationGrace(
  subscription: SubscriptionSnapshot | null,
) {
  if (
    !subscription ||
    subscription.status !== "canceled" ||
    subscription.cancel_at_period_end !== true ||
    !subscription.current_period_end
  ) {
    return false;
  }

  const paidThrough = Date.parse(subscription.current_period_end);

  return Number.isFinite(paidThrough) && paidThrough > Date.now();
}

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const query = await searchParams;
  const section = Array.isArray(query?.section)
    ? query.section[0]
    : query?.section;

  // Profile is a dedicated workspace. Old Settings profile links are retained
  // only as compatibility entry points and never render Profile inside Settings.
  if (section === "profile") {
    redirect("/dashboard/profile");
  }

  const requiredValue = Array.isArray(query?.required)
    ? query.required[0]
    : query?.required;
  const requiredFeature = isSubscriptionFeatureKey(requiredValue)
    ? requiredValue
    : null;
  const hasExplicitSettingsSection = [
    "security",
    "financial",
    "notifications",
    "appearance",
    "privacy",
    "subscription",
  ].includes(section ?? "");

  /*
   * Settings is a force-dynamic authenticated page, but its independent reads
   * do not need to form a latency waterfall. Start role verification, profile,
   * subscription presentation data, and verified entitlement resolution in the
   * same server turn. React cache still deduplicates getCurrentUser/requireAdmin.
   */
  const adminPromise = requireAdmin();
  const subscriptionPromise = supabase
    .from("subscriptions")
    .select(
      "plan_code,status,billing_interval,current_period_end,cancel_at_period_end,provider",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  const profilePromise = supabase
    .from("profiles")
    .select("base_currency")
    .eq("id", user.id)
    .maybeSingle();
  const verifiedAccessPromise = getCurrentSubscriptionAccess();

  const [
    { admin },
    { data: subscription },
    { data: profile },
    verifiedAccess,
  ] = await Promise.all([
    adminPromise,
    subscriptionPromise,
    profilePromise,
    verifiedAccessPromise,
  ]);

  const isSubscriptionExempt = Boolean(admin);
  const canManageWallpapers = admin?.role === "super_admin";
  const canAccessBackupRecovery = isOwnerEmail(user.email);

  if (isSubscriptionExempt && section === "subscription") {
    redirect("/dashboard/settings?section=security");
  }

  const profileSnapshot = (profile as ProfileSnapshot | null) ?? null;
  const subscriptionSnapshot =
    (subscription as SubscriptionSnapshot | null) ?? null;

  const effectivePlanCode = getEffectiveSubscriptionPlanCode(verifiedAccess);

  /*
   * The subscription row and this page query can race the server-side expiry
   * normalizer by a few milliseconds. Always render the verified effective
   * entitlement, so an expired canceled plan is shown as Free immediately even
   * if this request started with the old paid database snapshot.
   */
  const verifiedSubscriptionSnapshot =
    !isSubscriptionExempt &&
    effectivePlanCode === "free" &&
    subscriptionSnapshot?.plan_code !== "free"
      ? {
          ...subscriptionSnapshot,
          plan_code: "free",
          status: "active",
          billing_interval: null,
          current_period_end: null,
          cancel_at_period_end: false,
          provider: "internal",
        }
      : subscriptionSnapshot;

  const displaySubscription = hasPaidCancellationGrace(verifiedSubscriptionSnapshot)
    ? {
        ...verifiedSubscriptionSnapshot,
        status: "active",
      }
    : verifiedSubscriptionSnapshot;

  const metadata = user.user_metadata ?? {};

  return (
    <section
      className={`${styles.settingsRoot} ficonter-settings-page${
        isSubscriptionExempt ? " ficonter-subscription-exempt-settings" : ""
      }`}
      data-settings-detail={hasExplicitSettingsSection ? "true" : "false"}
    >
      <div className="page-heading ficonter-settings-page-heading">
        <div>
          <div className="eyebrow">Private preferences</div>
          <h1>Settings</h1>
          <p>
            Manage account security, financial preferences, notifications,
            appearance, privacy and subscription settings from one private workspace.
          </p>
        </div>
      </div>

      {!isSubscriptionExempt ? (
        <div className="ficonter-settings-subscription-summary">
          <CustomerSubscriptionManager subscription={verifiedSubscriptionSnapshot} />
        </div>
      ) : null}

      <div className="ficonter-settings-workspace-shell">
        <InstalledPwaSettingsWorkspace
          userId={user.id}
          email={user.email ?? ""}
          metadata={metadata}
          initialBaseCurrency={profileSnapshot?.base_currency ?? "EUR"}
          initialSection={section}
          subscription={isSubscriptionExempt ? null : displaySubscription}
          requiredFeature={requiredFeature}
          isSubscriptionExempt={isSubscriptionExempt}
          canManageWallpapers={canManageWallpapers}
        />

        <SettingsSupplementalModules
          userId={user.id}
          email={user.email ?? ""}
          metadata={metadata}
          canAccessBackupRecovery={canAccessBackupRecovery}
        />
      </div>
    </section>
  );
}
