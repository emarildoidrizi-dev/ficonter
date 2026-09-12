import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminDirectoryAutoRefresh } from "@/components/AdminDirectoryAutoRefresh";
import { AdminWorkspaceNavigation } from "@/components/AdminWorkspaceNavigation";
import { isOwnerEmail, requireAdmin } from "@/lib/admin/access";
import { loadPlatformHealth } from "@/lib/admin/health";
import {
  loadAdminDirectorySnapshot,
  type AdminAuditRow,
} from "@/lib/admin/snapshot";
import { getCurrentUser } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const { user, admin } = await requireAdmin();

  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard/access-denied");

  const { supabase } = await getCurrentUser();
  const [snapshot, logsResult, health] = await Promise.all([
    loadAdminDirectorySnapshot(supabase),
    supabase
      .from("admin_audit_logs")
      .select("id,admin_user_id,action,target_user_id,details,created_at")
      .order("created_at", { ascending: false })
      .limit(60),
    loadPlatformHealth(),
  ]);

  const directoryVersion = snapshot.users
    .map((account) =>
      [
        account.id,
        account.planCode ?? "free",
        account.subscriptionStatus ?? "none",
        account.provider ?? "internal",
        account.currentPeriodEnd ?? "none",
        account.cancelAtPeriodEnd ? "canceling" : "renewing",
        account.betaVerified ? "beta-verified" : "beta-unverified",
        account.role ?? "user",
        account.bannedUntil ?? "active",
      ].join(":"),
    )
    .join("|");

  return (
    <>
      <AdminWorkspaceNavigation />
      <AdminDirectoryAutoRefresh />
      <AdminDashboard
        key={directoryVersion}
        currentAdminId={user.id}
        currentRole={admin.role}
        currentIsOwner={isOwnerEmail(user.email)}
        initialUsers={snapshot.users}
        initialLogs={(logsResult.data ?? []) as AdminAuditRow[]}
        initialCounts={snapshot.counts}
        initialHealth={health}
      />
    </>
  );
}
