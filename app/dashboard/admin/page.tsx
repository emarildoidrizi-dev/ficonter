import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { createServiceClient, requireAdmin } from "@/lib/admin/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DAY = 24 * 60 * 60 * 1000;

function safeCount(result: { count: number | null; error: unknown }) {
  return result.error ? 0 : result.count ?? 0;
}

export default async function AdminPage() {
  const { user, admin } = await requireAdmin();

  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard");

  const service = createServiceClient();

  const [
    usersResult,
    adminRows,
    transactions,
    bills,
    goals,
    debts,
    planner,
    logs,
    storage,
  ] = await Promise.all([
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    service.from("admin_users").select("user_id,role"),
    service.from("transactions").select("id", { count: "exact", head: true }),
    service.from("bills").select("id", { count: "exact", head: true }),
    service.from("goals").select("id", { count: "exact", head: true }),
    service.from("debts").select("id", { count: "exact", head: true }),
    service.from("monthly_financial_plans").select("id", {
      count: "exact",
      head: true,
    }),
    service
      .from("admin_audit_logs")
      .select("id,admin_user_id,action,target_user_id,details,created_at")
      .order("created_at", { ascending: false })
      .limit(60),
    service.storage.from("profile-photos").list("", { limit: 1000 }),
  ]);

  const roles = new Map(
    (adminRows.data ?? []).map((row) => [row.user_id, row.role]),
  );

  const users = (usersResult.data?.users ?? []).map((item) => ({
    id: item.id,
    email: item.email ?? "",
    createdAt: item.created_at,
    lastSignInAt: item.last_sign_in_at ?? null,
    bannedUntil: item.banned_until ?? null,
    displayName: String(
      item.user_metadata?.display_name ??
        item.user_metadata?.full_name ??
        "",
    ),
    role: (roles.get(item.id) ?? null) as
      | "admin"
      | "super_admin"
      | null,
  }));

  const now = Date.now();
  const active7Days = users.filter(
    (item) =>
      item.lastSignInAt &&
      now - new Date(item.lastSignInAt).getTime() <= 7 * DAY,
  ).length;
  const active30Days = users.filter(
    (item) =>
      item.lastSignInAt &&
      now - new Date(item.lastSignInAt).getTime() <= 30 * DAY,
  ).length;
  const new7Days = users.filter(
    (item) => now - new Date(item.createdAt).getTime() <= 7 * DAY,
  ).length;
  const new30Days = users.filter(
    (item) => now - new Date(item.createdAt).getTime() <= 30 * DAY,
  ).length;

  return (
    <AdminDashboard
      currentAdminId={user.id}
      currentRole={admin.role}
      initialUsers={users}
      initialLogs={logs.data ?? []}
      counts={{
        users: users.length,
        active7Days,
        active30Days,
        new7Days,
        new30Days,
        transactions: safeCount(transactions),
        bills: safeCount(bills),
        goals: safeCount(goals),
        debts: safeCount(debts),
        plannerRecords: safeCount(planner),
        storageObjects: storage.data?.length ?? 0,
      }}
      system={{
        auth: usersResult.error ? "degraded" : "operational",
        database:
          transactions.error || bills.error || goals.error || debts.error
            ? "degraded"
            : "operational",
        storage: storage.error ? "degraded" : "operational",
        realtime: "configured",
      }}
    />
  );
}
