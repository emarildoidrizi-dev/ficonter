import { redirect } from "next/navigation";

import { CustomerSubscriptionManager } from "@/components/CustomerSubscriptionManager";
import { SettingsWorkspace } from "@/components/SettingsWorkspace";
import { requireAdmin } from "@/lib/admin/access";
import { getCurrentUser } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SettingsPageProps = {
  searchParams?: Promise<{
    section?: string | string[];
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

  const query = await searchParams;
  const section = Array.isArray(query?.section)
    ? query.section[0]
    : query?.section;

  if (isSubscriptionExempt && section === "subscription") {
    redirect("/dashboard/settings?section=profile");
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(
      "plan_code,status,billing_interval,current_period_end,cancel_at_period_end,provider",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const subscriptionSnapshot =
    (subscription as SubscriptionSnapshot | null) ?? null;

  const displaySubscription = hasPaidCancellationGrace(subscriptionSnapshot)
    ? {
        ...subscriptionSnapshot,
        status: "active",
      }
    : subscriptionSnapshot;

  return (
    <section
      className={
        isSubscriptionExempt
          ? "ficonter-subscription-exempt-settings"
          : undefined
      }
    >
      {isSubscriptionExempt ? (
        <style>{`
          .ficonter-subscription-exempt-settings
            aside[aria-label="Settings sections"]
            > div:nth-child(2)
            > button:nth-child(7) {
              display: none !important;
            }
        `}</style>
      ) : null}

      <div className="page-heading">
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
        <CustomerSubscriptionManager subscription={subscriptionSnapshot} />
      ) : null}

      <SettingsWorkspace
        userId={user.id}
        email={user.email ?? ""}
        metadata={user.user_metadata ?? {}}
        initialSection={section}
        subscription={isSubscriptionExempt ? null : displaySubscription}
      />
    </section>
  );
}
