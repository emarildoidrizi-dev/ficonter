import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
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

  const query = await searchParams;
  const section = Array.isArray(query?.section)
    ? query.section[0]
    : query?.section;

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_code,status,billing_interval,current_period_end,cancel_at_period_end,provider")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <section>
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
        subscription={subscription}
      />
    </section>
  );
}
