import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { RealtimeRefreshBridge } from "@/components/RealtimeRefreshBridge";
import { createServiceClient } from "@/lib/admin/access";

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

  const service = createServiceClient();
  const { data: admin } = await service
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="app-shell">
      <RealtimeRefreshBridge />
      <Sidebar isAdmin={Boolean(admin)} />
      <main className="app-main">{children}</main>
    </div>
  );
}
