import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { requireAdmin } from "@/lib/admin/access";
import {
  loadAdminDirectorySnapshot,
  type AdminAuditRow,
} from "@/lib/admin/snapshot";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const { user, admin } = await requireAdmin();

  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard");

  const supabase = await createClient();

  const [snapshot, logsResult] = await Promise.all([
    loadAdminDirectorySnapshot(supabase),
    supabase
      .from("admin_audit_logs")
      .select("id,admin_user_id,action,target_user_id,details,created_at")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const dataOperational =
    !snapshot.errors.directory &&
    !snapshot.errors.overview &&
    !logsResult.error;

  return (
    <AdminDashboard
      currentAdminId={user.id}
      currentRole={admin.role}
      initialUsers={snapshot.users}
      initialLogs={(logsResult.data ?? []) as AdminAuditRow[]}
      initialCounts={snapshot.counts}
      system={{
        auth: snapshot.errors.directory ? "degraded" : "operational",
        database: snapshot.errors.overview ? "degraded" : "operational",
        storage: snapshot.errors.overview ? "degraded" : "operational",
        realtime: dataOperational ? "operational" : "configured",
      }}
    />
  );
}
