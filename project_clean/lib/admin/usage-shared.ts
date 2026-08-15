export type UsageScope = "personal" | "business";

export type PlatformUsageRow = {
  userId: string;
  userName: string;
  email: string;
  accountStatus: "Active" | "Suspended";
  businessCount: number;
  ownedBusinessCount: number;
  businessNames: string[];
  roles: string[];
  isLive: boolean;
  currentWorkspace: UsageScope | null;
  currentModule: string | null;
  timeUsedTodaySeconds: number;
  sessionsToday: number;
  lastActiveAt: string | null;
  firstBusinessCreatedAt: string | null;
  accountCreatedAt: string;
};

export type PlatformUsageOverview = {
  totalUsers: number;
  liveNow: number;
  activeToday: number;
  totalSecondsToday: number;
  averageSecondsToday: number;
  sessionsToday: number;
};

type UsageRpcRow = {
  user_id?: unknown;
  user_name?: unknown;
  email?: unknown;
  account_status?: unknown;
  business_count?: unknown;
  owned_business_count?: unknown;
  business_names?: unknown;
  roles?: unknown;
  is_live?: unknown;
  current_workspace?: unknown;
  current_module?: unknown;
  time_used_today_seconds?: unknown;
  sessions_today?: unknown;
  last_active_at?: unknown;
  first_business_created_at?: unknown;
  account_created_at?: unknown;
};

type UsageOverviewRpc = {
  total_users?: unknown;
  live_now?: unknown;
  active_today?: unknown;
  total_seconds_today?: unknown;
  average_seconds_today?: unknown;
  sessions_today?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeCount(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.trunc(number)
    : 0;
}

function safeText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function safeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? value : null;
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function normalizePlatformUsageRows(
  rows: UsageRpcRow[] | null | undefined,
): PlatformUsageRow[] {
  return (rows ?? [])
    .filter(
      (row) =>
        typeof row.user_id === "string" &&
        UUID_PATTERN.test(row.user_id),
    )
    .map((row) => {
      const workspace =
        row.current_workspace === "personal" ||
        row.current_workspace === "business"
          ? row.current_workspace
          : null;

      return {
        userId: String(row.user_id),
        userName: safeText(row.user_name, "Unnamed user"),
        email: safeText(row.email, "Email unavailable"),
        accountStatus:
          row.account_status === "Suspended" ? "Suspended" : "Active",
        businessCount: safeCount(row.business_count),
        ownedBusinessCount: safeCount(row.owned_business_count),
        businessNames: safeStringArray(row.business_names),
        roles: safeStringArray(row.roles),
        isLive: row.is_live === true,
        currentWorkspace: workspace,
        currentModule: safeText(row.current_module) || null,
        timeUsedTodaySeconds: safeCount(row.time_used_today_seconds),
        sessionsToday: safeCount(row.sessions_today),
        lastActiveAt: safeDate(row.last_active_at),
        firstBusinessCreatedAt: safeDate(
          row.first_business_created_at,
        ),
        accountCreatedAt:
          safeDate(row.account_created_at) ??
          new Date(0).toISOString(),
      };
    });
}

export function normalizePlatformUsageOverview(
  value: UsageOverviewRpc | null | undefined,
): PlatformUsageOverview {
  return {
    totalUsers: safeCount(value?.total_users),
    liveNow: safeCount(value?.live_now),
    activeToday: safeCount(value?.active_today),
    totalSecondsToday: safeCount(value?.total_seconds_today),
    averageSecondsToday: safeCount(value?.average_seconds_today),
    sessionsToday: safeCount(value?.sessions_today),
  };
}

export const emptyPlatformUsageOverview: PlatformUsageOverview = {
  totalUsers: 0,
  liveNow: 0,
  activeToday: 0,
  totalSecondsToday: 0,
  averageSecondsToday: 0,
  sessionsToday: 0,
};
