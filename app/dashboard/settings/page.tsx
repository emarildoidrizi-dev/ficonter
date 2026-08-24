import { redirect } from "next/navigation";

import { CustomerSubscriptionManager } from "@/components/CustomerSubscriptionManager";
import { ProfileIdentityDetailsForm } from "@/components/ProfileIdentityDetailsForm";
import { SettingsWorkspace } from "@/components/SettingsWorkspace";
import { requireAdmin } from "@/lib/admin/access";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { isSubscriptionFeatureKey } from "@/lib/subscriptionNavigation";
import { getCurrentSubscriptionAccess } from "@/lib/subscriptionAccess";

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
  birth_date?: string | null;
  country?: string | null;
  city?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
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

  const { admin } = await requireAdmin();
  const isSubscriptionExempt = Boolean(admin);
  const canManageWallpapers = admin?.role === "super_admin";

  const query = await searchParams;
  const section = Array.isArray(query?.section)
    ? query.section[0]
    : query?.section;
  const requiredValue = Array.isArray(query?.required)
    ? query.required[0]
    : query?.required;
  const requiredFeature = isSubscriptionFeatureKey(requiredValue)
    ? requiredValue
    : null;
  const hasExplicitSettingsSection = [
    "profile",
    "security",
    "financial",
    "notifications",
    "appearance",
    "privacy",
    "subscription",
  ].includes(section ?? "");

  if (isSubscriptionExempt && section === "subscription") {
    redirect("/dashboard/settings?section=security");
  }

  const [
    { data: subscription },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "plan_code,status,billing_interval,current_period_end,cancel_at_period_end,provider",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("base_currency,birth_date,country,city,address_line1,address_line2,postal_code")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const profileSnapshot = (profile as ProfileSnapshot | null) ?? null;
  const subscriptionSnapshot =
    (subscription as SubscriptionSnapshot | null) ?? null;

  const verifiedAccess = await getCurrentSubscriptionAccess();

  // A legacy Beta row without a code-verified entitlement is presented as Free,
  // matching the server-side entitlement engine and the Beta-domain gate.
  const verifiedSubscriptionSnapshot =
    !isSubscriptionExempt &&
    subscriptionSnapshot?.plan_code === "beta" &&
    verifiedAccess.planCode !== "beta"
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

  /*
   * The database correctly stores a PayPal cancellation as "canceled".
   * If the customer has already paid through a future date, Settings should
   * still present that paid plan as active until the date actually arrives.
   */
  const displaySubscription = hasPaidCancellationGrace(verifiedSubscriptionSnapshot)
    ? {
        ...verifiedSubscriptionSnapshot,
        status: "active",
      }
    : verifiedSubscriptionSnapshot;

  return (
    <section
      className={`ficonter-settings-page${
        isSubscriptionExempt ? " ficonter-subscription-exempt-settings" : ""
      }`}
      data-settings-detail={hasExplicitSettingsSection ? "true" : "false"}
    >
      <div className="page-heading ficonter-settings-page-heading">
        <div>
          <div className="eyebrow">Private preferences</div>
          <h1>Settings</h1>
          <p>
            Manage your profile, account security and Ficonter preferences from
            one private workspace.
          </p>
        </div>
      </div>

      {!isSubscriptionExempt ? (
        <div className="ficonter-settings-subscription-summary">
          <CustomerSubscriptionManager subscription={verifiedSubscriptionSnapshot} />
        </div>
      ) : null}

      <div className="ficonter-settings-workspace-shell">
        <SettingsWorkspace
          userId={user.id}
          email={user.email ?? ""}
          metadata={user.user_metadata ?? {}}
          initialBaseCurrency={profileSnapshot?.base_currency ?? "EUR"}
          initialSection={section}
          subscription={isSubscriptionExempt ? null : displaySubscription}
          requiredFeature={requiredFeature}
          isSubscriptionExempt={isSubscriptionExempt}
          canManageWallpapers={canManageWallpapers}
        />

        {section === "profile" ? (
          <div style={{ marginTop: 16 }}>
            <ProfileIdentityDetailsForm
              userId={user.id}
              initialValues={{
                birthDate: profileSnapshot?.birth_date ?? "",
                country: profileSnapshot?.country ?? "",
                city: profileSnapshot?.city ?? "",
                addressLine1: profileSnapshot?.address_line1 ?? "",
                addressLine2: profileSnapshot?.address_line2 ?? "",
                postalCode: profileSnapshot?.postal_code ?? "",
              }}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
