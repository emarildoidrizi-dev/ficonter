import { redirect } from "next/navigation";

import { SettingsWorkspace } from "@/components/SettingsWorkspace";
import { getCurrentUser } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfilePage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <section>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Private profile</div>
          <h1>Profile</h1>
          <p>
            Manage your identity, profile photo and login email in one private
            place.
          </p>
        </div>
      </div>

      <SettingsWorkspace
        userId={user.id}
        email={user.email ?? ""}
        metadata={user.user_metadata ?? {}}
        initialBaseCurrency={profile?.base_currency ?? "EUR"}
        initialSection="profile"
        subscription={null}
        requiredFeature={null}
        isSubscriptionExempt={false}
        profileOnly={true}
      />
    </section>
  );
}
