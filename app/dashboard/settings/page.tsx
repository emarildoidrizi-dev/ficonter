import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireAdmin } from "@/lib/admin/access";
import { SettingsWorkspace } from "@/components/SettingsWorkspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SettingsPageProps = {
  searchParams?: Promise<{
    section?: string | string[];
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const { admin } = await requireAdmin();
  const isSubscriptionExempt = Boolean(admin);

  const query = await searchParams;
  const section = Array.isArray(query?.section)
    ? query.section[0]
    : query?.section;

  /*
   * Owner / Super Admin / Admin accounts are subscription-exempt.
   * They must never see or enter the commercial Subscription section.
   */
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

  return (
    <section
      className={
        isSubscriptionExempt ? "ficonter-subscription-exempt-settings" : undefined
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

      <SettingsWorkspace
        userId={user.id}
        email={user.email ?? ""}
        metadata={user.user_metadata ?? {}}
        initialSection={section}
        subscription={isSubscriptionExempt ? null : subscription}
      />
    </section>
  );
}
