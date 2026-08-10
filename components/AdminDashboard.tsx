"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  HardDrive,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  Users,
  X,
  XCircle,
} from "lucide-react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  type AdminAuditRow,
  type AdminCounts,
  type AdminRole,
  type AdminUserRow,
} from "@/lib/admin/snapshot";
import type {
  HealthServiceKey,
  HealthStatus,
  PlatformHealthSnapshot,
} from "@/lib/admin/health-shared";
import { createClient } from "@/lib/supabase/client";
import styles from "./AdminDashboard.module.css";

type PatchAction =
  | "suspend"
  | "restore"
  | "promote_admin"
  | "demote_admin"
  | "promote_super_admin"
  | "demote_super_admin"
  | "revoke_beta";
type UserAction = PatchAction | "delete_user";
type Toast = {
  id: string;
  type: "success" | "error";
  title: string;
  message: string;
};
type PendingAction = {
  action: UserAction;
  user: AdminUserRow;
};
type PlanFilter =
  | "all"
  | "free"
  | "beta"
  | "personal_pro"
  | "business_pro"
  | "exempt";

type ActionCopy = {
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
  successTitle: string;
  successMessage: string;
  danger: boolean;
};

const TOAST_DURATION_MS = 5000;
const HEALTH_REFRESH_INTERVAL_MS = 60_000;
const HEALTH_SERVICE_ORDER: HealthServiceKey[] = [
  "auth",
  "database",
  "storage",
  "realtime",
];

function formatHealthTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function statusLabel(status: HealthStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "Never";
}

function planLabel(user: AdminUserRow) {
  if (user.isOwner || user.role) return "Exempt";
  const labels: Record<string, string> = {
    beta: "Beta",
    free: "Free",
    personal_pro: "Personal Pro",
    business_pro: "Business Pro",
  };
  return user.planCode ? labels[user.planCode] ?? user.planCode : "Free";
}

function providerLabel(user: AdminUserRow) {
  if (user.isOwner || user.role) return "Role based";
  if (!user.provider) return "Internal";
  return user.provider === "paypal" ? "PayPal" : "Internal";
}

function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatAuditTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    suspend: "Account suspended",
    restore: "Account restored",
    promote_admin: "Promoted to Admin",
    demote_admin: "Admin role removed",
    promote_super_admin: "Promoted to Super Admin",
    demote_super_admin: "Super Admin demoted",
    revoke_beta: "Beta access revoked",
    delete_user_requested: "Deletion requested",
    delete_user: "Account deleted",
    delete_user_failed: "Deletion failed",
  };
  return labels[action] ?? action.replaceAll("_", " ");
}

function stringDetail(
  details: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function actionCopy(pending: PendingAction): ActionCopy {
  const account = pending.user.displayName || pending.user.email;

  switch (pending.action) {
    case "suspend":
      return {
        eyebrow: "ACCOUNT ACCESS",
        title: `Suspend ${account}?`,
        description:
          "This account will be blocked from signing in until an administrator restores it. Its financial records will remain private and unchanged.",
        confirmLabel: "Suspend account",
        successTitle: "Account suspended",
        successMessage: `${account} can no longer sign in until restored.`,
        danger: true,
      };
    case "restore":
      return {
        eyebrow: "ACCOUNT ACCESS",
        title: `Restore ${account}?`,
        description:
          "This will remove the suspension and allow the account to sign in again using its existing credentials.",
        confirmLabel: "Restore account",
        successTitle: "Account restored",
        successMessage: `${account} can sign in again.`,
        danger: false,
      };
    case "promote_admin":
      return {
        eyebrow: "ADMIN PERMISSIONS",
        title: `Make ${account} an admin?`,
        description:
          "This grants privacy-safe platform administration access. The account will be able to manage users and view aggregate platform information, but never customer financial values.",
        confirmLabel: "Make admin",
        successTitle: "Admin access granted",
        successMessage: `${account} is now an administrator.`,
        danger: false,
      };
    case "demote_admin":
      return {
        eyebrow: "ADMIN PERMISSIONS",
        title: `Remove admin access?`,
        description:
          `${account} will immediately lose access to the administration area but will remain an active registered FICONTER user.`,
        confirmLabel: "Remove admin",
        successTitle: "Admin access removed",
        successMessage: `${account} is now a standard registered user.`,
        danger: true,
      };
    case "promote_super_admin":
      return {
        eyebrow: "OWNER ROLE CONTROL",
        title: `Make ${account} a Super Admin?`,
        description:
          "This grants senior platform administration authority. Super Admins can manage normal users and ordinary Admins, but cannot override the Owner, create another Super Admin, revoke Beta, or permanently delete accounts.",
        confirmLabel: "Make Super Admin",
        successTitle: "Super Admin authority granted",
        successMessage: `${account} is now a Super Admin.`,
        danger: false,
      };
    case "demote_super_admin":
      return {
        eyebrow: "OWNER ROLE CONTROL",
        title: `Demote ${account} to Admin?`,
        description:
          "This removes Super Admin authority and keeps the account as an ordinary Admin with the lower operational permission set.",
        confirmLabel: "Demote to Admin",
        successTitle: "Super Admin authority removed",
        successMessage: `${account} is now an Admin.`,
        danger: true,
      };
    case "revoke_beta":
      return {
        eyebrow: "OWNER ACCESS CONTROL",
        title: `Revoke Beta access for ${account}?`,
        description:
          "This removes the verified Beta entitlement and every active Beta session for this normal customer. The account will immediately return to Ficonter Free and premium Beta features will lock again.",
        confirmLabel: "Revoke Beta access",
        successTitle: "Beta access revoked",
        successMessage: `${account} is now on Ficonter Free.`,
        danger: true,
      };
    case "delete_user":
      return {
        eyebrow: "PERMANENT ACTION",
        title: `Permanently delete ${account}?`,
        description:
          "This permanently deletes the authentication account and all linked database records. Profile storage objects are also removed. This action cannot be undone or recovered.",
        confirmLabel: "Permanently delete",
        successTitle: "Account permanently deleted",
        successMessage: `${account} and its linked records were deleted.`,
        danger: true,
      };
  }
}

function uniqueToastId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AdminDashboard({
  currentAdminId,
  currentRole,
  currentIsOwner,
  initialUsers,
  initialLogs,
  initialCounts,
  initialHealth,
}: {
  currentAdminId: string;
  currentRole: AdminRole;
  currentIsOwner: boolean;
  initialUsers: AdminUserRow[];
  initialLogs: AdminAuditRow[];
  initialCounts: AdminCounts;
  initialHealth: PlatformHealthSnapshot;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState(initialUsers);
  const [logs, setLogs] = useState(initialLogs);
  const [counts, setCounts] = useState(initialCounts);
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [busy, setBusy] = useState<PendingAction | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [health, setHealth] = useState(initialHealth);
  const [healthRefreshing, setHealthRefreshing] = useState(false);
  const toastTimers = useRef(new Map<string, number>());
  const refreshTimer = useRef<number | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const realtimeStartedAt = useRef<number | null>(null);

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    toastTimers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (type: Toast["type"], title: string, message: string) => {
      const id = uniqueToastId();
      const toast = { id, type, title, message };
      setToasts((current) => [...current, toast].slice(-4));
      const timer = window.setTimeout(
        () => dismissToast(id),
        TOAST_DURATION_MS,
      );
      toastTimers.current.set(id, timer);
    },
    [dismissToast],
  );

  const refreshDirectory = useCallback(
    async (showFailure = false) => {
      setRefreshing(true);
      try {
        const response = await fetch("/api/admin/users", {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as {
          users?: AdminUserRow[];
          counts?: AdminCounts;
          error?: string;
        } | null;

        if (!response.ok || !data?.users || !data.counts) {
          throw new Error(data?.error ?? "The account directory could not be refreshed.");
        }

        setUsers(data.users);
        setCounts(data.counts);
        setPending((current) =>
          current && data.users?.some((user) => user.id === current.user.id)
            ? current
            : null,
        );
      } catch (error) {
        if (showFailure) {
          showToast(
            "error",
            "Refresh failed",
            error instanceof Error
              ? error.message
              : "The account directory could not be refreshed.",
          );
        }
      } finally {
        setRefreshing(false);
      }
    },
    [showToast],
  );

  const refreshHealth = useCallback(
    async (showFailure = false) => {
      setHealthRefreshing(true);
      try {
        const response = await fetch("/api/admin/health", {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as
          | PlatformHealthSnapshot
          | { error?: string }
          | null;

        if (!response.ok || !data || !("services" in data)) {
          const message =
            data && "error" in data && typeof data.error === "string"
              ? data.error
              : "Platform health could not be refreshed.";
          throw new Error(message);
        }

        setHealth((current) => ({
          ...data,
          services: {
            ...data.services,
            realtime: current.services.realtime,
          },
        }));
      } catch (error) {
        const checkedAt = new Date().toISOString();
        setHealth((current) => ({
          checkedAt,
          services: {
            auth: {
              status: "offline",
              latencyMs: null,
              checkedAt,
              message: "The automatic health check could not reach this service.",
            },
            database: {
              status: "offline",
              latencyMs: null,
              checkedAt,
              message: "The automatic health check could not reach this service.",
            },
            storage: {
              status: "offline",
              latencyMs: null,
              checkedAt,
              message: "The automatic health check could not reach this service.",
            },
            realtime: current.services.realtime,
          },
        }));

        if (showFailure) {
          showToast(
            "error",
            "Health check failed",
            error instanceof Error
              ? error.message
              : "Platform health could not be refreshed.",
          );
        }
      } finally {
        setHealthRefreshing(false);
      }
    },
    [showToast],
  );

  const scheduleDirectoryRefresh = useCallback(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      void refreshDirectory(false);
    }, 180);
  }, [refreshDirectory]);

  useEffect(() => {
    let active = true;
    realtimeStartedAt.current = performance.now();

    const channel = supabase
      .channel("admin-user-management-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "admin_audit_logs",
        },
        (payload: RealtimePostgresChangesPayload<AdminAuditRow>) => {
          if (payload.eventType === "DELETE") {
            const removed = payload.old as Partial<AdminAuditRow>;
            if (removed.id) {
              setLogs((current) =>
                current.filter((item) => item.id !== removed.id),
              );
            }
          } else {
            const next = payload.new as AdminAuditRow;
            setLogs((current) => [
              next,
              ...current.filter((item) => item.id !== next.id),
            ]);
          }
          scheduleDirectoryRefresh();
        },
      )
      .subscribe((status) => {
        if (!active) return;

        const checkedAt = new Date().toISOString();
        const latencyMs = realtimeStartedAt.current
          ? Math.max(0, Math.round(performance.now() - realtimeStartedAt.current))
          : null;

        if (status !== "SUBSCRIBED") {
          realtimeStartedAt.current = performance.now();
        }

        const realtimeStatus: HealthStatus =
          status === "SUBSCRIBED"
            ? latencyMs !== null && latencyMs >= 2_500
              ? "degraded"
              : "healthy"
            : status === "TIMED_OUT"
              ? "degraded"
              : "offline";

        setHealth((current) => ({
          ...current,
          checkedAt,
          services: {
            ...current.services,
            realtime: {
              status: realtimeStatus,
              latencyMs: status === "SUBSCRIBED" ? latencyMs : null,
              checkedAt,
              message:
                status === "SUBSCRIBED"
                  ? realtimeStatus === "healthy"
                    ? "The live Realtime channel is connected."
                    : "The live Realtime channel connected slowly."
                  : status === "TIMED_OUT"
                    ? "The live Realtime connection timed out."
                    : "The live Realtime channel is disconnected.",
            },
          },
        }));
      });

    return () => {
      active = false;
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      toastTimers.current.forEach((timer) => window.clearTimeout(timer));
      toastTimers.current.clear();
      void supabase.removeChannel(channel);
    };
  }, [scheduleDirectoryRefresh, supabase]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshHealth(false);
    }, HEALTH_REFRESH_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void refreshHealth(false);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshHealth]);

  useEffect(() => {
    if (!pending) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => confirmButtonRef.current?.focus(), 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) setPending(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, pending]);

  const planCounts = useMemo(
    () => ({
      free: users.filter((user) => user.role === null && (user.planCode ?? "free") === "free").length,
      beta: users.filter((user) => user.role === null && user.planCode === "beta").length,
      personal_pro: users.filter((user) => user.role === null && user.planCode === "personal_pro").length,
      business_pro: users.filter((user) => user.role === null && user.planCode === "business_pro").length,
      exempt: users.filter((user) => user.isOwner || user.role !== null).length,
    }),
    [users],
  );

  const filteredUsers = useMemo(() => {
    const value = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !value ||
        user.email.toLowerCase().includes(value) ||
        user.displayName.toLowerCase().includes(value);
      const matchesPlan =
        planFilter === "all" ||
        (planFilter === "exempt"
          ? user.isOwner || user.role !== null
          : !user.isOwner && user.role === null && (user.planCode ?? "free") === planFilter);
      return matchesQuery && matchesPlan;
    });
  }, [planFilter, query, users]);

  const userGroups = useMemo(
    () => [
      {
        key: "owner",
        label: "Owner",
        users: filteredUsers.filter((user) => user.isOwner),
      },
      {
        key: "super-admin",
        label: "Super Admin",
        users: filteredUsers.filter(
          (user) =>
            user.role === "super_admin" &&
            (!currentIsOwner || user.id !== currentAdminId),
        ),
      },
      {
        key: "admins",
        label: "Admins",
        users: filteredUsers.filter((user) => user.role === "admin"),
      },
      {
        key: "registered-users",
        label: "Registered Users",
        users: filteredUsers.filter((user) => !user.isOwner && user.role === null),
      },
    ],
    [currentAdminId, currentIsOwner, filteredUsers],
  );

  const userMap = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );

  const orderedLogs = useMemo(
    () =>
      [...logs].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [logs],
  );

  function isProtected(user: AdminUserRow) {
    if (user.isOwner || user.id === currentAdminId) return true;
    if (user.role === "super_admin" && !currentIsOwner) return true;
    return false;
  }

  function canManageStatus(user: AdminUserRow) {
    if (isProtected(user)) return false;
    if (currentIsOwner) return true;
    if (currentRole === "super_admin") return user.role !== "super_admin";
    return user.role === null;
  }

  function canDelete(user: AdminUserRow) {
    if (isProtected(user)) return false;
    return currentIsOwner;
  }

  function applyResponseUser(
    current: AdminUserRow[],
    next: Partial<AdminUserRow> & { id: string },
  ) {
    return current.map((user) =>
      user.id === next.id ? { ...user, ...next } : user,
    );
  }

  async function confirmAction() {
    if (!pending || busy) return;

    const copy = actionCopy(pending);
    setBusy(pending);

    try {
      const isDelete = pending.action === "delete_user";
      const response = await fetch(`/api/admin/users/${pending.user.id}`, {
        method: isDelete ? "DELETE" : "PATCH",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          ...(isDelete ? {} : { "Content-Type": "application/json" }),
        },
        ...(isDelete ? {} : { body: JSON.stringify({ action: pending.action }) }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        deletedUserId?: string;
        user?: Partial<AdminUserRow> & { id: string };
        audit?: AdminAuditRow;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? `Request failed (${response.status}).`);
      }

      if (isDelete) {
        setUsers((current) =>
          current.filter((user) => user.id !== pending.user.id),
        );
        setCounts((current) => ({
          ...current,
          users: Math.max(0, current.users - 1),
        }));
      } else if (data?.user) {
        setUsers((current) => applyResponseUser(current, data.user!));
      }

      if (data?.audit) {
        setLogs((current) => [
          data.audit!,
          ...current.filter((item) => item.id !== data.audit?.id),
        ]);
      }

      setPending(null);
      showToast("success", copy.successTitle, copy.successMessage);
      scheduleDirectoryRefresh();
    } catch (error) {
      showToast(
        "error",
        "Action not completed",
        error instanceof Error
          ? error.message
          : "The admin action could not be completed.",
      );
    } finally {
      setBusy(null);
    }
  }

  const aggregateRecords =
    counts.transactions +
    counts.bills +
    counts.goals +
    counts.debts +
    counts.plannerRecords;
  const pendingCopy = pending ? actionCopy(pending) : null;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>PRIVATE ADMINISTRATION</span>
          <h1>Platform control</h1>
          <p>
            Privacy-safe operational oversight. Individual financial values are
            never displayed here.
          </p>
        </div>
        <div className={styles.status}>
          <ShieldCheck size={15} />
          Administration secured
        </div>
      </header>

      <div className={styles.kpis}>
        <article>
          <Users />
          <span>Registered users</span>
          <strong>{users.length}</strong>
          <small>{counts.new30Days} joined in 30 days</small>
        </article>
        <article>
          <UserCheck />
          <span>Active in 7 days</span>
          <strong>{counts.active7Days}</strong>
          <small>{counts.active30Days} active in 30 days</small>
        </article>
        <article>
          <Activity />
          <span>Platform records</span>
          <strong>{aggregateRecords}</strong>
          <small>Aggregate counts only</small>
        </article>
        <article>
          <HardDrive />
          <span>Storage objects</span>
          <strong>{counts.storageObjects}</strong>
          <small>Aggregate object count</small>
        </article>
      </div>

      <div className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <span>USER MANAGEMENT</span>
              <h2>Accounts</h2>
            </div>
            <div className={styles.accountTools}>
              <label>
                <Search size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name or email"
                  aria-label="Search accounts by display name or email"
                />
              </label>
              <button
                type="button"
                className={styles.refreshButton}
                onClick={() => void refreshDirectory(true)}
                disabled={refreshing}
                aria-label="Refresh user directory"
                title="Refresh user directory"
              >
                <RefreshCw
                  size={16}
                  className={refreshing ? styles.spinning : undefined}
                />
              </button>
            </div>
          </div>

          <div className={styles.privacyNote}>
            Only account identity, status, subscription and role are shown. Financial balances,
            transactions, bills, debts, savings, goals and planner values are not
            accessible here.
          </div>

          <div className={styles.planFilters} aria-label="Filter accounts by plan">
            {[
              ["all", "All", users.length],
              ["free", "Free", planCounts.free],
              ["beta", "Beta", planCounts.beta],
              ["personal_pro", "Personal Pro", planCounts.personal_pro],
              ["business_pro", "Business Pro", planCounts.business_pro],
              ["exempt", "Exempt", planCounts.exempt],
            ].map(([value, label, count]) => (
              <button
                key={String(value)}
                type="button"
                className={planFilter === value ? styles.planFilterActive : undefined}
                onClick={() => setPlanFilter(value as PlanFilter)}
              >
                <span>{String(label)}</span>
                <strong>{Number(count)}</strong>
              </button>
            ))}
          </div>

          <div className={`${styles.table} ficonter-scroll-region`}>
            <div className={styles.rowHead}>
              <span>Account</span>
              <span>Created</span>
              <span>Last sign-in</span>
              <span>Status</span>
              <span>Plan</span>
              <span>Provider</span>
              <span>Role</span>
              <span>Actions</span>
            </div>

            {userGroups.map((group) => (
              <div key={group.key} className={styles.userGroup}>
                <div className={styles.groupDivider}>
                  <span>{group.label}</span>
                  <i />
                  <small>{group.users.length}</small>
                </div>

                {group.users.map((user) => {
                  const protectedAccount = isProtected(user);
                  const rowBusy = busy?.user.id === user.id;

                  return (
                    <div
                      key={user.id}
                      className={`${styles.row}${
                        user.role === "super_admin"
                          ? ` ${styles.superAdminRow}`
                          : ""
                      }`}
                    >
                      <span>
                        <strong>{user.displayName || "Unnamed user"}</strong>
                        <small>{user.email}</small>
                      </span>
                      <span>{formatDate(user.createdAt)}</span>
                      <span>{formatDate(user.lastSignInAt)}</span>
                      <span>
                        <b
                          className={
                            user.bannedUntil ? styles.suspended : styles.active
                          }
                        >
                          {user.bannedUntil ? "Suspended" : "Active"}
                        </b>
                      </span>
                      <span>
                        <b
                          className={
                            user.planCode === "beta"
                              ? styles.betaPlan
                              : user.planCode === "personal_pro" ||
                                  user.planCode === "business_pro"
                                ? styles.paidPlan
                                : styles.standard
                          }
                        >
                          {planLabel(user)}
                        </b>
                        {user.planCode === "beta" ? (
                          <small>{user.betaVerified ? "Verified" : "Unverified"}</small>
                        ) : user.subscriptionStatus ? (
                          <small>{user.subscriptionStatus.replace("_", " ")}</small>
                        ) : null}
                      </span>
                      <span>
                        <b className={styles.standard}>{providerLabel(user)}</b>
                      </span>
                      <span>
                        <b className={user.role ? styles.role : styles.standard}>
                          {user.isOwner
                            ? "Owner"
                            : user.role === "super_admin"
                              ? "Super Admin"
                              : user.role === "admin"
                                ? "Admin"
                                : "User"}
                        </b>
                      </span>
                      <span className={styles.actions}>
                        {protectedAccount ? (
                          <span className={styles.protected}>
                            <ShieldCheck size={15} /> Protected Account
                          </span>
                        ) : (
                          <>
                            {canManageStatus(user) ? (
                              <button
                                type="button"
                                disabled={rowBusy}
                                onClick={() =>
                                  setPending({
                                    user,
                                    action: user.bannedUntil
                                      ? "restore"
                                      : "suspend",
                                  })
                                }
                              >
                                {rowBusy ? (
                                  <LoaderCircle
                                    size={15}
                                    className={styles.spinning}
                                  />
                                ) : user.bannedUntil ? (
                                  <RefreshCw size={15} />
                                ) : (
                                  <Ban size={15} />
                                )}
                                {user.bannedUntil ? "Restore" : "Suspend"}
                              </button>
                            ) : null}

                            {currentRole === "super_admin" ? (
                              <>
                                {user.role === "admin" ? (
                                  <button
                                    type="button"
                                    disabled={rowBusy}
                                    onClick={() =>
                                      setPending({ user, action: "demote_admin" })
                                    }
                                  >
                                    <UserCog size={15} /> Remove Admin
                                  </button>
                                ) : user.role === null ? (
                                  <button
                                    type="button"
                                    disabled={rowBusy}
                                    onClick={() =>
                                      setPending({ user, action: "promote_admin" })
                                    }
                                  >
                                    <ShieldCheck size={15} /> Make Admin
                                  </button>
                                ) : null}

                                {currentIsOwner &&
                                (user.role === null || user.role === "admin") ? (
                                  <button
                                    type="button"
                                    disabled={rowBusy}
                                    onClick={() =>
                                      setPending({
                                        user,
                                        action: "promote_super_admin",
                                      })
                                    }
                                  >
                                    <ShieldAlert size={15} /> Make Super Admin
                                  </button>
                                ) : null}

                                {currentIsOwner && user.role === "super_admin" ? (
                                  <button
                                    type="button"
                                    disabled={rowBusy}
                                    onClick={() =>
                                      setPending({
                                        user,
                                        action: "demote_super_admin",
                                      })
                                    }
                                  >
                                    <UserCog size={15} /> Demote to Admin
                                  </button>
                                ) : null}
                              </>
                            ) : null}

                            {currentIsOwner &&
                            !user.isOwner &&
                            user.role === null &&
                            user.planCode === "beta" ? (
                              <button
                                type="button"
                                className={styles.revokeBeta}
                                disabled={rowBusy}
                                onClick={() =>
                                  setPending({ user, action: "revoke_beta" })
                                }
                              >
                                <XCircle size={15} /> Revoke Beta
                              </button>
                            ) : null}

                            {canDelete(user) ? (
                              <button
                                type="button"
                                className={styles.delete}
                                disabled={rowBusy}
                                onClick={() =>
                                  setPending({ user, action: "delete_user" })
                                }
                              >
                                <Trash2 size={15} /> Delete
                              </button>
                            ) : null}
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}

            {!filteredUsers.length ? (
              <div className={styles.noResults}>
                <Search size={20} />
                <strong>No matching accounts</strong>
                <span>Search by display name or full email address.</span>
              </div>
            ) : null}
          </div>
        </article>

        <aside className={styles.side}>
          <article className={styles.panel}>
            <div className={styles.healthHeader}>
              <div>
                <span>PLATFORM HEALTH</span>
                <h2>Systems</h2>
              </div>
              <button
                type="button"
                className={styles.healthRefresh}
                onClick={() => void refreshHealth(true)}
                disabled={healthRefreshing}
                aria-label="Refresh platform health"
                title="Run health checks now"
              >
                <RefreshCw
                  size={15}
                  className={healthRefreshing ? styles.spinning : undefined}
                />
              </button>
            </div>
            <ul className={styles.systemList}>
              {HEALTH_SERVICE_ORDER.map((name) => {
                const check = health.services[name];
                return (
                  <li key={name}>
                    <span>
                      {check.status === "healthy" ? (
                        <CheckCircle2 size={16} />
                      ) : check.status === "degraded" ? (
                        <AlertTriangle size={16} />
                      ) : (
                        <XCircle size={16} />
                      )}
                      <span className={styles.healthName}>
                        <strong>{name}</strong>
                        <small>{check.message}</small>
                      </span>
                    </span>
                    <span className={styles.healthResult}>
                      <b className={styles[check.status]}>
                        {statusLabel(check.status)}
                      </b>
                      <small>
                        {check.latencyMs !== null
                          ? `${check.latencyMs} ms`
                          : "No response"}
                      </small>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className={styles.healthCheckedAt}>
              Automatically checked at {formatHealthTime(health.checkedAt)}.
              Rechecks every minute.
            </p>
          </article>

          <article className={styles.panel}>
            <span>MODULE COUNTS</span>
            <h2>Usage</h2>
            <ul>
              <li>
                Transactions <b>{counts.transactions}</b>
              </li>
              <li>
                Bills <b>{counts.bills}</b>
              </li>
              <li>
                Goals <b>{counts.goals}</b>
              </li>
              <li>
                Debt <b>{counts.debts}</b>
              </li>
              <li>
                Planner <b>{counts.plannerRecords}</b>
              </li>
              <li>
                Storage objects <b>{counts.storageObjects}</b>
              </li>
              <li>
                Registered users <b>{users.length}</b>
              </li>
              <li>
                Active users <b>{counts.active30Days}</b>
              </li>
            </ul>
            <p className={styles.aggregateDisclaimer}>
              Counts indicate usage only. No customer financial amounts are
              shown.
            </p>
          </article>

          <article className={`${styles.panel} ${styles.auditPanel}`}>
            <span>ADMIN AUDIT</span>
            <h2>Recent actions</h2>

            <div className={`${styles.auditScroll} ficonter-scroll-region`}>
              <div className={styles.logs}>
                {orderedLogs.length ? (
                  orderedLogs.map((log) => {
                    const actor = userMap.get(log.admin_user_id);
                    const target = log.target_user_id
                      ? userMap.get(log.target_user_id)
                      : null;
                    const targetName =
                      stringDetail(log.details, "target_display_name") ||
                      stringDetail(log.details, "target_email") ||
                      target?.displayName ||
                      target?.email ||
                      "Deleted account";
                    const actorName =
                      stringDetail(log.details, "admin_display_name") ||
                      stringDetail(log.details, "admin_email") ||
                      actor?.displayName ||
                      actor?.email ||
                      "Administrator";

                    return (
                      <div key={log.id} className={styles.logItem}>
                        <span className={styles.logIcon}>
                          <ShieldAlert size={15} />
                        </span>
                        <div className={styles.auditFields}>
                          <span>
                            <small>Action</small>
                            <strong>{actionLabel(log.action)}</strong>
                          </span>
                          <span>
                            <small>User</small>
                            <strong>{targetName}</strong>
                          </span>
                          <span>
                            <small>Admin</small>
                            <strong>{actorName}</strong>
                          </span>
                          <span>
                            <small>Date</small>
                            <strong>{formatAuditDate(log.created_at)}</strong>
                          </span>
                          <span>
                            <small>Time</small>
                            <strong>{formatAuditTime(log.created_at)}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.emptyAudit}>
                    <ShieldCheck size={20} />
                    <strong>No admin actions yet</strong>
                    <span>
                      Completed user-management actions will appear here in real
                      time.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {orderedLogs.length > 6 ? (
              <div className={styles.auditHint}>
                Scroll to view {orderedLogs.length - 6} older action
                {orderedLogs.length - 6 === 1 ? "" : "s"}
              </div>
            ) : null}
          </article>
        </aside>
      </div>

      <div
        className={styles.toastRegion}
        aria-live="polite"
        aria-label="Admin notifications"
      >
        {toasts.map((toast) => (
          <article
            key={toast.id}
            className={`${styles.toast} ${
              toast.type === "success" ? styles.toastSuccess : styles.toastError
            }`}
          >
            <span className={styles.toastIcon}>
              {toast.type === "success" ? (
                <CheckCircle2 size={19} />
              ) : (
                <AlertTriangle size={19} />
              )}
            </span>
            <div>
              <strong>{toast.title}</strong>
              <p>{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
            <i className={styles.toastTimer} />
          </article>
        ))}
      </div>

      {pending && pendingCopy ? (
        <div
          className={styles.backdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setPending(null);
          }}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-confirmation-title"
          >
            <div className={styles.modalIcon}>
              {pendingCopy.danger ? (
                <AlertTriangle size={22} />
              ) : (
                <ShieldCheck size={22} />
              )}
            </div>
            <span>{pendingCopy.eyebrow}</span>
            <h2 id="admin-confirmation-title">{pendingCopy.title}</h2>
            <p>{pendingCopy.description}</p>
            <div className={styles.modalAccount}>
              <strong>{pending.user.displayName}</strong>
              <span>{pending.user.email}</span>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={Boolean(busy)}
              >
                Cancel
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                data-enter-confirm="true"
                className={pendingCopy.danger ? styles.danger : styles.primary}
                onClick={() => void confirmAction()}
                disabled={Boolean(busy)}
              >
                {busy ? (
                  <LoaderCircle size={16} className={styles.spinning} />
                ) : null}
                {busy ? "Processing…" : pendingCopy.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
