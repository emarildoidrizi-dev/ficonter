"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Ban,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./AdminDashboard.module.css";

type AdminRole = "admin" | "super_admin";

type UserRow = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  bannedUntil: string | null;
  displayName: string;
  role: AdminRole | null;
};

type LogRow = {
  id: string;
  admin_user_id: string;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

type Counts = {
  users: number;
  active7Days: number;
  active30Days: number;
  new7Days: number;
  new30Days: number;
  transactions: number;
  bills: number;
  goals: number;
  debts: number;
  plannerRecords: number;
  storageObjects: number;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "Never";
}

function formatAuditDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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
    promote_admin: "Promoted to admin",
    promote_super_admin: "Promoted to super admin",
    demote_admin: "Admin role removed",
    delete_user: "Account deleted",
  };
  return labels[action] ?? action.replaceAll("_", " ");
}

export function AdminDashboard({
  currentAdminId,
  currentRole,
  initialUsers,
  initialLogs,
  counts,
  system,
}: {
  currentAdminId: string;
  currentRole: AdminRole;
  initialUsers: UserRow[];
  initialLogs: LogRow[];
  counts: Counts;
  system: Record<string, "operational" | "degraded" | "configured">;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState(initialUsers);
  const [logs, setLogs] = useState(initialLogs);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("admin-audit-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_audit_logs",
        },
        (payload) => {
          const next = payload.new as LogRow;
          setLogs((current) => [
            next,
            ...current.filter((item) => item.id !== next.id),
          ]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => {
        const rank = (role: AdminRole | null) =>
          role === "super_admin" ? 0 : role === "admin" ? 1 : 2;
        return rank(a.role) - rank(b.role);
      }),
    [users],
  );

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return sortedUsers.filter(
      (user) =>
        !value ||
        user.email.toLowerCase().includes(value) ||
        user.displayName.toLowerCase().includes(value),
    );
  }, [query, sortedUsers]);

  const userMap = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );

  async function requestAction(
    user: UserRow,
    action:
      | "suspend"
      | "restore"
      | "promote_admin"
      | "promote_super_admin"
      | "demote_admin",
  ) {
    if (user.id === currentAdminId) {
      setMessage(
        "The current super-admin account is protected and cannot be changed here.",
      );
      return;
    }

    setBusy(user.id);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        role?: AdminRole | null;
        audit?: LogRow;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? `Request failed (${response.status}).`);
      }

      setUsers((current) =>
        current.map((item) => {
          if (item.id !== user.id) return item;
          if (action === "suspend") {
            return { ...item, bannedUntil: "9999-12-31T00:00:00Z" };
          }
          if (action === "restore") {
            return { ...item, bannedUntil: null };
          }
          return { ...item, role: data?.role ?? null };
        }),
      );

      if (data?.audit) {
        setLogs((current) => [
          data.audit as LogRow,
          ...current.filter((item) => item.id !== data.audit?.id),
        ]);
      }

      setMessage("Admin action completed successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The admin action could not be completed.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    if (!deleteTarget) return;

    setBusy(deleteTarget.id);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        audit?: LogRow;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? `Request failed (${response.status}).`);
      }

      setUsers((current) =>
        current.filter((item) => item.id !== deleteTarget.id),
      );

      if (data?.audit) {
        setLogs((current) => [
          data.audit as LogRow,
          ...current.filter((item) => item.id !== data.audit?.id),
        ]);
      }

      setDeleteTarget(null);
      setMessage("Account permanently deleted.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The account could not be deleted.",
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
          <i />
          Admin systems online
        </div>
      </header>

      {message ? <div className={styles.notice}>{message}</div> : null}

      <div className={styles.kpis}>
        <article><Users /><span>Registered users</span><strong>{users.length}</strong><small>{counts.new30Days} joined in 30 days</small></article>
        <article><UserCheck /><span>Active in 7 days</span><strong>{counts.active7Days}</strong><small>{counts.active30Days} active in 30 days</small></article>
        <article><Activity /><span>Platform records</span><strong>{aggregateRecords}</strong><small>Aggregate counts only</small></article>
        <article><HardDrive /><span>Storage objects</span><strong>{counts.storageObjects}</strong><small>Profile-photo objects</small></article>
      </div>

      <div className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <div><span>USER MANAGEMENT</span><h2>Accounts</h2></div>
            <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search account" /></label>
          </div>

          <div className={styles.privacyNote}>
            Only account identity, status and role are shown. Financial balances,
            transactions and private notes are not accessible here.
          </div>

          <div className={styles.table}>
            <div className={styles.rowHead}>
              <span>Account</span><span>Created</span><span>Last sign-in</span>
              <span>Status</span><span>Role</span><span>Actions</span>
            </div>

            {filtered.map((user, index) => {
              const isSelf = user.id === currentAdminId;
              const showDivider =
                index > 0 &&
                filtered[index - 1]?.role !== null &&
                user.role === null;

              return (
                <div key={user.id}>
                  {showDivider ? (
                    <div className={styles.registeredDivider}>
                      <span>Registered users</span><i />
                    </div>
                  ) : null}

                  <div className={`${styles.row}${user.role === "super_admin" ? ` ${styles.superAdminRow}` : ""}`}>
                    <span><strong>{user.displayName || "Unnamed user"}</strong><small>{user.email}</small></span>
                    <span>{formatDate(user.createdAt)}</span>
                    <span>{formatDate(user.lastSignInAt)}</span>
                    <span><b className={user.bannedUntil ? styles.suspended : styles.active}>{user.bannedUntil ? "Suspended" : "Active"}</b></span>
                    <span><b className={user.role ? styles.role : styles.standard}>{user.role?.replace("_", " ") ?? "User"}</b></span>
                    <span className={styles.actions}>
                      {isSelf ? (
                        <span className={styles.you}>Protected account</span>
                      ) : (
                        <>
                          <button type="button" disabled={busy === user.id} onClick={() => requestAction(user, user.bannedUntil ? "restore" : "suspend")}>
                            {user.bannedUntil ? <RefreshCw size={15} /> : <Ban size={15} />}
                            {user.bannedUntil ? "Restore" : "Suspend"}
                          </button>

                          {currentRole === "super_admin" ? (
                            user.role ? (
                              <button type="button" disabled={busy === user.id} onClick={() => requestAction(user, "demote_admin")}>
                                <UserCog size={15} />Remove admin
                              </button>
                            ) : (
                              <button type="button" disabled={busy === user.id} onClick={() => requestAction(user, "promote_admin")}>
                                <ShieldCheck size={15} />Make admin
                              </button>
                            )
                          ) : null}

                          <button type="button" className={styles.delete} disabled={busy === user.id} onClick={() => setDeleteTarget(user)}>
                            <Trash2 size={15} />Delete
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <aside className={styles.side}>
          <article className={styles.panel}>
            <span>PLATFORM HEALTH</span><h2>Systems</h2>
            <ul className={styles.systemList}>
              {Object.entries(system).map(([name, status]) => (
                <li key={name}>
                  <span>{status === "degraded" ? <XCircle size={16} /> : <CheckCircle2 size={16} />}{name}</span>
                  <b className={status === "degraded" ? styles.bad : styles.good}>{status}</b>
                </li>
              ))}
            </ul>
          </article>

          <article className={styles.panel}>
            <span>MODULE COUNTS</span><h2>Usage</h2>
            <ul>
              <li>Transactions <b>{counts.transactions}</b></li>
              <li>Bills <b>{counts.bills}</b></li>
              <li>Goals <b>{counts.goals}</b></li>
              <li>Debt accounts <b>{counts.debts}</b></li>
              <li>Planner records <b>{counts.plannerRecords}</b></li>
            </ul>
            <p className={styles.aggregateDisclaimer}>Counts indicate usage only. No customer financial amounts are shown.</p>
          </article>

          <article className={`${styles.panel} ${styles.auditPanel}`}>
            <span>ADMIN AUDIT</span><h2>Recent actions</h2>

            <div className={styles.auditScroll}>
              <div className={styles.logs}>
                {logs.length ? logs.map((log) => {
                  const actor = userMap.get(log.admin_user_id);
                  const target = log.target_user_id ? userMap.get(log.target_user_id) : null;
                  const targetEmail = String(log.details?.target_email ?? "") || target?.email || "account";

                  return (
                    <div key={log.id} className={styles.logItem}>
                      <span className={styles.logIcon}><ShieldAlert size={15} /></span>
                      <span className={styles.logCopy}>
                        <strong>{actionLabel(log.action)}</strong>
                        <small>{targetEmail} · by {actor?.displayName || actor?.email || "Admin"}</small>
                        <time>{formatAuditDateTime(log.created_at)}</time>
                      </span>
                    </div>
                  );
                }) : (
                  <div className={styles.emptyAudit}>
                    <ShieldCheck size={20} /><strong>No admin actions yet</strong>
                    <span>Use Suspend, Restore, Make admin, Remove admin or Delete on a test account.</span>
                  </div>
                )}
              </div>
            </div>

            {logs.length > 6 ? (
              <div className={styles.auditHint}>
                Scroll to view {logs.length - 6} older action{logs.length - 6 === 1 ? "" : "s"}
              </div>
            ) : null}
          </article>
        </aside>
      </div>

      {deleteTarget ? (
        <div className={styles.backdrop}>
          <div className={styles.modal}>
            <span>PERMANENT ACTION</span><h2>Delete account?</h2>
            <p>The account for <strong>{deleteTarget.email}</strong> and its linked records will be permanently deleted.</p>
            <div>
              <button type="button" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className={styles.danger} onClick={deleteAccount} disabled={busy === deleteTarget.id}>
                {busy === deleteTarget.id ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
