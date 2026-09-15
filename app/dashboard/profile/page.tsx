import { redirect } from "next/navigation";

import { ProfileIdentityDetailsForm } from "@/components/ProfileIdentityDetailsForm";
import { SettingsWorkspace } from "@/components/SettingsWorkspace";
import { getCurrentUser } from "@/lib/auth/currentUser";
import styles from "./ProfilePage.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProfileSnapshot = {
  base_currency?: string | null;
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
      "base_currency,birth_date,country,city,address_line1,address_line2,postal_code",
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
          <div className="eyebrow">Private account</div>
          <h1>Profile</h1>
          <p>
            Manage your identity, profile photo and sign-in email independently
            from Ficonter Settings.
          </p>
        </div>
      </div>

      <div
        id="ficonter-standalone-profile"
        className={styles.profileWorkspace}
      >
        <SettingsWorkspace
          userId={user.id}
          email={user.email ?? ""}
          metadata={metadata}
          initialBaseCurrency={profileSnapshot?.base_currency ?? "EUR"}
          initialSection="profile"
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
      </div>
    </section>
  );
}
