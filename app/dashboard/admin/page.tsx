import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { createServiceClient, requireAdmin } from "@/lib/admin/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const { user, admin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard");

  const service = createServiceClient();
  const [{ data: usersData }, tx, bills, goals, debt, logs, storage] = await Promise.all([
    service.auth.admin.listUsers({ page: 1, perPage: 200 }),
    service.from("transactions").select("id", { count: "exact", head: true }),
    service.from("bills").select("id", { count: "exact", head: true }),
    service.from("goals").select("id", { count: "exact", head: true }),
    service.from("debts").select("id", { count: "exact", head: true }),
    service.from("admin_audit_logs").select("id,action,target_user_id,details,created_at").order("created_at", { ascending: false }).limit(30),
    service.storage.from("profile-photos").list("", { limit: 1000 }),
  ]);

  const users = (usersData?.users ?? []).map((item) => ({
    id: item.id,
    email: item.email ?? "",
    createdAt: item.created_at,
    lastSignInAt: item.last_sign_in_at ?? null,
    bannedUntil: item.banned_until ?? null,
    displayName: String(item.user_metadata?.display_name ?? item.user_metadata?.full_name ?? ""),
  }));

  return <AdminDashboard initialUsers={users} initialLogs={logs.data ?? []} counts={{ users: users.length, transactions: tx.count ?? 0, bills: bills.count ?? 0, goals: goals.count ?? 0, debts: debt.count ?? 0, storageObjects: storage.data?.length ?? 0 }} />;
}
