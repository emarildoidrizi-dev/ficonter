import { redirect } from "next/navigation";

import { ProfileIdentityDetailsForm } from "@/components/ProfileIdentityDetailsForm";
import { ProfileWorkspace } from "@/components/ProfileWorkspace";
import { getCurrentUser } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProfileSnapshot = {
  birth_date?: string | null;
  country?: string | null;
  city?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
};

export default async function ProfilePage() {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "birth_date,country,city,address_line1,address_line2,postal_code",
    )
    .eq("id", user.id)
    .maybeSingle();

  const profileSnapshot = (profile as ProfileSnapshot | null) ?? null;
  const metadata = user.user_metadata ?? {};
  const fullName = String(metadata.full_name ?? metadata.name ?? "").trim();
  const displayName = String(
    metadata.display_name ?? metadata.full_name ?? metadata.name ?? "",
  ).trim();

  return (
    <section className="ficonter-profile-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Personal identity</div>
          <h1>Profile</h1>
          <p>
            Manage your identity, profile photo, personal details and login email
            from your dedicated Profile workspace.
          </p>
        </div>
      </div>

      <ProfileWorkspace
        userId={user.id}
        email={user.email ?? ""}
        metadata={metadata}
      />

      <ProfileIdentityDetailsForm
        userId={user.id}
        initialFullName={fullName}
        initialDisplayName={displayName}
        initialValues={{
          birthDate: profileSnapshot?.birth_date ?? "",
          country: profileSnapshot?.country ?? "",
          city: profileSnapshot?.city ?? "",
          addressLine1: profileSnapshot?.address_line1 ?? "",
          addressLine2: profileSnapshot?.address_line2 ?? "",
          postalCode: profileSnapshot?.postal_code ?? "",
        }}
      />
    </section>
  );
}
