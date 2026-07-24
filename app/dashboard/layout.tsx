import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { RealtimeRefreshBridge } from "@/components/RealtimeRefreshBridge";
import { requireAdmin } from "@/lib/admin/access";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, admin } = await requireAdmin();

  if (!user) redirect("/login");

  return (
    <div className="app-shell">
      <RealtimeRefreshBridge />
      <Sidebar isAdmin={Boolean(admin)} />
      <main className="app-main">{children}</main>
    </div>
  );
}
