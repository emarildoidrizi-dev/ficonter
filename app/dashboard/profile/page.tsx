import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, Mail, Settings2, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfilePage() {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect("/login");

  const metadata = user.user_metadata ?? {};
  const displayName = String(
    metadata.display_name ?? metadata.full_name ?? metadata.name ?? "Account",
  );
  const avatarPath = String(metadata.avatar_path ?? "");
  let avatarUrl = "";

  if (avatarPath) {
    const { data } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(avatarPath, 60 * 60);
    avatarUrl = data?.signedUrl ?? "";
  }

  return (
    <section className="fui-profile-page">
      <div className="fui-profile-card">
        <div className="fui-profile-avatar" aria-hidden="true">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <UserRound size={34} />
          )}
          <span><Camera size={14} /></span>
        </div>

        <div className="fui-profile-copy">
          <span>Personal workspace</span>
          <h1>{displayName}</h1>
          <p><Mail size={15} /> {user.email ?? ""}</p>
        </div>

        <dl className="fui-profile-details">
          <div><dt>Workspace</dt><dd>Personal</dd></div>
          <div><dt>Account</dt><dd>FICONTER</dd></div>
        </dl>

        <Link className="fui-profile-edit" href="/dashboard/settings?section=profile">
          <Settings2 size={17} /> Open account settings
        </Link>
      </div>
    </section>
  );
}
