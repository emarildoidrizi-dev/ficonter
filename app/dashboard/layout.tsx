import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { RealtimeRefreshBridge } from "@/components/RealtimeRefreshBridge";
import { UserProfileMenu } from "@/components/UserProfileMenu";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const metadata = user.user_metadata ?? {};

  return (
    <div className="app-shell">
      <RealtimeRefreshBridge />
      <Sidebar />

      <main className="app-main">
        <div className="account-header">
          <UserProfileMenu
            email={user.email ?? ""}
            fullName={String(metadata.full_name ?? metadata.name ?? "")}
            displayName={String(
              metadata.display_name ?? metadata.full_name ?? metadata.name ?? "",
            )}
            profilePhoto={String(metadata.avatar_data_url ?? "")}
          />
        </div>

        {children}
      </main>
    </div>
  );
}
