"use client";

import {
  Activity,
  Building2,
  CalendarDays,
  Clock3,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  normalizePlatformUsageOverview,
  normalizePlatformUsageRows,
  type PlatformUsageOverview,
  type PlatformUsageRow,
  type UsageScope,
} from "@/lib/admin/usage-shared";
import styles from "./PlatformUsageDirectory.module.css";

type StatusFilter = "all" | "live" | "active_today" | "suspended";

const AUTO_REFRESH_MS = 30_000;

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.trunc(totalSeconds));
  if (seconds < 60) return seconds ? "< 1 min" : "0 min";

  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) return `${totalMinutes} min`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded yet";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) return "No business yet";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function workspaceLabel(value: UsageScope | null) {
  if (value === "personal") return "Personal";
  if (value === "business") return "Business";
  return "Not active";
}

export function PlatformUsageDirectory({
  scope,
  initialRows,
  initialOverview,
  initialError = "",
}: {
  scope: UsageScope;
  initialRows: PlatformUsageRow[];
  initialOverview: PlatformUsageOverview;
  initialError?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(initialRows);
  const [overview, setOverview] = useState(initialOverview);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(initialError);

  const refresh = useCallback(
    async (showFailure = false) => {
      setRefreshing(true);

      const [directoryResult, overviewResult] = await Promise.all([
        supabase.rpc("admin_usage_directory", {
          p_scope: scope,
        }),
        supabase.rpc("admin_usage_overview", {
          p_scope: scope,
        }),
      ]);

      if (directoryResult.error || overviewResult.error) {
        if (showFailure) {
          setError(
            directoryResult.error?.message ??
              overviewResult.error?.message ??
              "Usage analytics could not be refreshed.",
          );
        }
        setRefreshing(false);
        return;
      }

      setRows(
        normalizePlatformUsageRows(
          directoryResult.data as Record<string, unknown>[] | null,
        ),
      );
      setOverview(
        normalizePlatformUsageOverview(
          overviewResult.data as Record<string, unknown> | null,
        ),
      );
      setError("");
      setRefreshing(false);
    },
    [scope, supabase],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh(false);
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [refresh]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          row.userName,
          row.email,
          row.businessNames.join(" "),
          row.roles.join(" "),
          row.currentModule ?? "",
          row.currentWorkspace ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "live" && row.isLive) ||
        (statusFilter === "active_today" &&
          row.timeUsedTodaySeconds > 0) ||
        (statusFilter === "suspended" &&
          row.accountStatus === "Suspended");

      return matchesQuery && matchesStatus;
    });
  }, [query, rows, statusFilter]);

  const title =
    scope === "business"
      ? "Business Users"
      : "Personal Users";
  const description =
    scope === "business"
      ? "Business accounts, memberships and Business-workspace activity."
      : "Registered accounts and Personal-workspace activity.";

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span>
            {scope === "business"
              ? "BUSINESS PLATFORM ADMIN"
              : "PERSONAL PLATFORM ADMIN"}
          </span>
          <h1>{title} — Live & Usage</h1>
          <p>
            {description} Financial values, transactions, reports and
            document contents remain private.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refresh(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={17}
            className={refreshing ? styles.spinning : ""}
          />
          {refreshing ? "Refreshing…" : "Refresh now"}
        </button>
      </header>

      {error ? (
        <div className={styles.error}>
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className={styles.metrics}>
        <article>
          <Users size={21} />
          <span>Total users</span>
          <strong>{overview.totalUsers}</strong>
        </article>
        <article>
          <Wifi size={21} />
          <span>Live now</span>
          <strong>{overview.liveNow}</strong>
        </article>
        <article>
          <UserCheck size={21} />
          <span>Active today</span>
          <strong>{overview.activeToday}</strong>
        </article>
        <article>
          <Clock3 size={21} />
          <span>Total time today</span>
          <strong>
            {formatDuration(overview.totalSecondsToday)}
          </strong>
        </article>
        <article>
          <Activity size={21} />
          <span>Average per active user</span>
          <strong>
            {formatDuration(overview.averageSecondsToday)}
          </strong>
        </article>
        <article>
          <CalendarDays size={21} />
          <span>Sessions today</span>
          <strong>{overview.sessionsToday}</strong>
        </article>
      </div>

      <div className={styles.toolbar}>
        <label>
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search user, email, business, role or module"
          />
        </label>

        <div className={styles.filters}>
          {(
            [
              ["all", "All"],
              ["live", "Live now"],
              ["active_today", "Active today"],
              ["suspended", "Suspended"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={
                statusFilter === value ? styles.activeFilter : ""
              }
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.resultLine}>
        <span>
          Showing {filteredRows.length} of {rows.length} users
        </span>
        <small>
          Live = visible and active during the last 2 minutes. Idle
          tracking stops after 5 minutes.
        </small>
      </div>

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Account</th>
              <th>Businesses</th>
              <th>Role</th>
              <th>Live activity</th>
              <th>Time today</th>
              <th>Last active</th>
              <th>First business</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.userId}>
                <td>
                  <div className={styles.userCell}>
                    <span>
                      {row.userName.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <strong>{row.userName}</strong>
                      <small>{row.email}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className={
                      row.accountStatus === "Suspended"
                        ? styles.suspendedBadge
                        : styles.activeBadge
                    }
                  >
                    {row.accountStatus}
                  </span>
                </td>
                <td>
                  <div className={styles.businessCell}>
                    <strong>
                      {row.businessCount} total
                      {row.ownedBusinessCount
                        ? ` · ${row.ownedBusinessCount} owned`
                        : ""}
                    </strong>
                    <small>
                      {row.businessNames.length
                        ? row.businessNames.join(", ")
                        : "No business membership"}
                    </small>
                  </div>
                </td>
                <td>
                  <div className={styles.roleList}>
                    {row.roles.length ? (
                      row.roles.map((role) => (
                        <span key={role}>{role}</span>
                      ))
                    ) : (
                      <small>No business role</small>
                    )}
                  </div>
                </td>
                <td>
                  <div className={styles.liveCell}>
                    <span
                      className={
                        row.isLive
                          ? styles.liveBadge
                          : styles.offlineBadge
                      }
                    >
                      <i />
                      {row.isLive ? "Live now" : "Not live"}
                    </span>
                    <small>
                      {workspaceLabel(row.currentWorkspace)}
                      {row.currentModule
                        ? ` · ${row.currentModule}`
                        : ""}
                    </small>
                  </div>
                </td>
                <td>
                  <div className={styles.timeCell}>
                    <strong>
                      {formatDuration(row.timeUsedTodaySeconds)}
                    </strong>
                    <small>
                      {row.sessionsToday}{" "}
                      {row.sessionsToday === 1
                        ? "session"
                        : "sessions"}
                    </small>
                  </div>
                </td>
                <td>{formatDateTime(row.lastActiveAt)}</td>
                <td>{formatDate(row.firstBusinessCreatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!filteredRows.length ? (
          <div className={styles.empty}>
            <Building2 size={34} />
            <h2>No matching users</h2>
            <p>Change the search or status filter.</p>
          </div>
        ) : null}
      </div>

      <footer className={styles.privacy}>
        <ShieldAlert size={18} />
        <div>
          <strong>Privacy-safe operational analytics</strong>
          <p>
            This records account identity, business memberships,
            workspace, module, active duration and last-seen time only.
            It never records balances, transaction values, descriptions,
            uploaded-document contents, typed text or mouse movements.
            Historical usage begins after this update is installed.
          </p>
        </div>
      </footer>
    </section>
  );
}
