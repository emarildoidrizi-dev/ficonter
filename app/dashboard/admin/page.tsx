import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { requireAdmin } from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DirectoryRow = {
  user_id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  display_name: string;
  role: "admin" | "super_admin" | null;
};

type Overview = {
  users: number;
  active_7_days: number;
  active_30_days: number;
  new_7_days: number;
  new_30_days: number;
  transactions: number;
  bills: number;
  goals: number;
  debts: number;
  planner_records: number;
  storage_objects: number;
};

const emptyOverview: Overview = {
  users: 0,
  active_7_days: 0,
  active_30_days: 0,
  new_7_days: 0,
  new_30_days: 0,
  transactions: 0,
  bills: 0,
  goals: 0,
  debts: 0,
  planner_records: 0,
  storage_objects: 0,
};

export default async function AdminPage() {
  const { user, admin } = await requireAdmin();

  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard");

  const supabase = await createClient();

  const [directoryResult, overviewResult, logsResult] = await Promise.all([
    supabase.rpc("admin_account_directory"),
    supabase.rpc("admin_platform_overview"),
    supabase
      .from("admin_audit_logs")
      .select("id,admin_user_id,action,target_user_id,details,created_at")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const directory = (directoryResult.data ?? []) as DirectoryRow[];
  const overview = {
    ...emptyOverview,
    ...((overviewResult.data ?? {}) as Partial<Overview>),
  };

  const users = directory
    .filter(
      (item) =>
        typeof item.user_id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          item.user_id,
        ),
    )
    .map((item) => ({
      id: item.user_id,
      email: item.email,
      createdAt: item.created_at,
      lastSignInAt: item.last_sign_in_at,
      bannedUntil: item.banned_until,
      displayName: item.display_name,
      role: item.role,
    }));

  const dataOperational =
    !directoryResult.error && !overviewResult.error && !logsResult.error;

  return (
    <AdminDashboard
      currentAdminId={user.id}
      currentRole={admin.role}
      initialUsers={users}
      initialLogs={logsResult.data ?? []}
      counts={{
        users: overview.users,
        active7Days: overview.active_7_days,
        active30Days: overview.active_30_days,
        new7Days: overview.new_7_days,
        new30Days: overview.new_30_days,
        transactions: overview.transactions,
        bills: overview.bills,
        goals: overview.goals,
        debts: overview.debts,
        plannerRecords: overview.planner_records,
        storageObjects: overview.storage_objects,
      }}
      system={{
        auth: directoryResult.error ? "degraded" : "operational",
        database: overviewResult.error ? "degraded" : "operational",
        storage: overviewResult.error ? "degraded" : "operational",
        realtime: dataOperational ? "operational" : "configured",
      }}
    />
  );
}
