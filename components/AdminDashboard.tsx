"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const [users, setUsers] = useState(initialUsers);
  const [logs, setLogs] = useState(initialLogs);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const router = useRouter();

  useEffect(() => {
    setUsers(initialUsers);
    setLogs(initialLogs);
  }, [initialUsers, initialLogs]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      router.refresh();
    }, 10000);

    return () => window.clearInterval(timer);
  }, [router]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return users.filter(
      (user) =>
        !value ||
        user.email.toLowerCase().includes(value) ||
        user.displayName.toLowerCase().includes(value),
    );
  }, [query, users]);

  async function runAction(
    user: UserRow,
    action:
      | "suspend"
      | "restore"
      | "promote_admin"
      | "promote_super_admin"
      | "demote_admin",
  ) {
    setBusy(user.id);
    setMessage("");

    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    const data = (await response.json().catch(() => null)) as {
      error?: string;
      role?: AdminRole | null;
    } | null;

    if (!response.ok) {
      setMessage(data?.error ?? "The action could not be completed.");
      setBusy(null);
      return;
    }

    setUsers((current) =>
      current.map((item) => {
        if (item.id !== user.id) return item;
        if (action === "suspend")
          return { ...item, bannedUntil: "9999-12-31T00:00:00Z" };
        if (action === "restore") return { ...item, bannedUntil: null };
        return { ...item, role: data?.role ?? null };
      }),
    );

    setLogs((current) => [
      {
        id: crypto.randomUUID(),
        admin_user_id: currentAdminId,
        action,
        target_user_id: user.id,
        details: data?.role ? { role: data.role } : {},
        created_at: new Date().toISOString(),
      },
      ...current,
    ]);

    setMessage("Admin action completed.");
    setBusy(null);
  }

  async function deleteAccount() {
    if (!deleteTarget) return;

    setBusy(deleteTarget.id);

    const response = await fetch(`/api/admin/users/${deleteTarget.id}`, {
      method: "DELETE",
    });

    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setMessage(data?.error ?? "The account could not be deleted.");
      setBusy(null);
      return;
    }

    setUsers((current) =>
      current.filter((item) => item.id !== deleteTarget.id),
    );
    setDeleteTarget(null);
    setMessage("Account permanently deleted.");
    setBusy(null);
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
          Live data · refreshes every 10 seconds
        </div>
      </header>

      {message ? <div className={styles.notice}>{message}</div> : null}

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
          <small>Profile-photo objects</small>
        </article>
      </div>

      <div className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <span>USER MANAGEMENT</span>
              <h2>Accounts</h2>
            </div>
            <label>
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search account"
              />
            </label>
          </div>

          <div className={styles.privacyNote}>
            Only account identity, status and role are shown. Financial balances,
            transactions and private notes are not accessible here.
          </div>

          <div className={styles.table}>
            <div className={styles.rowHead}>
              <span>Account</span>
              <span>Created</span>
              <span>Last sign-in</span>
              <span>Status</span>
              <span>Role</span>
              <span>Actions</span>
            </div>

            {filtered.map((user) => {
              const isSelf = user.id === currentAdminId;

              return (
                <div className={styles.row} key={user.id}>
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
                    <b className={user.role ? styles.role : styles.standard}>
                      {user.role?.replace("_", " ") ?? "User"}
                    </b>
                  </span>
                  <span className={styles.actions}>
                    {!isSelf ? (
                      <>
                        <button
                          disabled={busy === user.id}
                          onClick={() =>
                            runAction(
                              user,
                              user.bannedUntil ? "restore" : "suspend",
                            )
                          }
                        >
                          {user.bannedUntil ? (
                            <RefreshCw size={15} />
                          ) : (
                            <Ban size={15} />
                          )}
                          {user.bannedUntil ? "Restore" : "Suspend"}
                        </button>

                        {currentRole === "super_admin" ? (
                          user.role ? (
                            <button
                              disabled={busy === user.id}
                              onClick={() =>
                                runAction(user, "demote_admin")
                              }
                            >
                              <UserCog size={15} />
                              Remove admin
                            </button>
                          ) : (
                            <button
                              disabled={busy === user.id}
                              onClick={() =>
                                runAction(user, "promote_admin")
                              }
                            >
                              <ShieldCheck size={15} />
                              Make admin
                            </button>
                          )
                        ) : null}

                        <button
                          className={styles.delete}
                          disabled={busy === user.id}
                          onClick={() => setDeleteTarget(user)}
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className={styles.you}>Current account</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </article>

        <aside className={styles.side}>
          <article className={styles.panel}>
            <span>PLATFORM HEALTH</span>
            <h2>Systems</h2>
            <ul className={styles.systemList}>
              {Object.entries(system).map(([name, status]) => (
                <li key={name}>
                  <span>
                    {status === "degraded" ? (
                      <XCircle size={16} />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    {name}
                  </span>
                  <b className={status === "degraded" ? styles.bad : styles.good}>
                    {status}
                  </b>
                </li>
              ))}
            </ul>
          </article>

          <article className={styles.panel}>
            <span>MODULE COUNTS</span>
            <h2>Usage</h2>
            <ul>
              <li>Transactions <b>{counts.transactions}</b></li>
              <li>Bills <b>{counts.bills}</b></li>
              <li>Goals <b>{counts.goals}</b></li>
              <li>Debt accounts <b>{counts.debts}</b></li>
              <li>Planner records <b>{counts.plannerRecords}</b></li>
            </ul>
            <p className={styles.aggregateDisclaimer}>
              Counts indicate usage only. No customer financial amounts are
              shown.
            </p>
          </article>

          <article className={styles.panel}>
            <span>ADMIN AUDIT</span>
            <h2>Recent actions</h2>
            <div className={styles.logs}>
              {logs.length ? (
                logs.slice(0, 20).map((log) => (
                  <div key={log.id}>
                    <ShieldAlert size={15} />
                    <span>
                      <strong>{log.action.replaceAll("_", " ")}</strong>
                      <small>
                        {new Date(log.created_at).toLocaleString("en-GB")}
                      </small>
                    </span>
                  </div>
                ))
              ) : (
                <p>No admin actions recorded yet.</p>
              )}
            </div>
          </article>
        </aside>
      </div>

      {deleteTarget ? (
        <div className={styles.backdrop}>
          <div className={styles.modal}>
            <span>PERMANENT ACTION</span>
            <h2>Delete account?</h2>
            <p>
              The account for <strong>{deleteTarget.email}</strong> and its
              linked records will be permanently deleted.
            </p>
            <div>
              <button onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className={styles.danger}
                onClick={deleteAccount}
                disabled={busy === deleteTarget.id}
              >
                {busy === deleteTarget.id ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
