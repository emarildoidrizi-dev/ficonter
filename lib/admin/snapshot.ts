import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";
import { isOwnerEmail } from "@/lib/admin/access";

export type AdminRole = "admin" | "super_admin";
export type SubscriptionPlanCode =
  | "beta"
  | "free"
  | "personal_pro"
  | "business_pro";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

export type AdminUserRow = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  bannedUntil: string | null;
  displayName: string;
  role: AdminRole | null;
  isOwner: boolean;
  planCode: SubscriptionPlanCode | null;
  subscriptionStatus: SubscriptionStatus | null;
  provider: string | null;
  billingInterval: "monthly" | "annual" | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  betaVerified: boolean;
};

export type AdminAuditRow = {
  id: string;
  admin_user_id: string;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type AdminCounts = {
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

type DirectoryRpcRow = {
  user_id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  display_name: string | null;
  role: AdminRole | null;
};

type OverviewRpc = {
  users?: number;
  active_7_days?: number;
  active_30_days?: number;
  new_7_days?: number;
  new_30_days?: number;
  transactions?: number;
  bills?: number;
  goals?: number;
  debts?: number;
  planner_records?: number;
  storage_objects?: number;
};

type SubscriptionRow = {
  user_id: string;
  plan_code: SubscriptionPlanCode;
  status: SubscriptionStatus;
  provider: string | null;
  billing_interval: "monthly" | "annual" | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

type BetaEntitlementRow = { user_id: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const emptyAdminCounts: AdminCounts = {
  users: 0,
  active7Days: 0,
  active30Days: 0,
  new7Days: 0,
  new30Days: 0,
  transactions: 0,
  bills: 0,
  goals: 0,
  debts: 0,
  plannerRecords: 0,
  storageObjects: 0,
};

function toSafeCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0;
}

export function normalizeAdminDirectory(
  rows: DirectoryRpcRow[] | null | undefined,
): AdminUserRow[] {
  return (rows ?? [])
    .filter(
      (row) =>
        typeof row.user_id === "string" && UUID_PATTERN.test(row.user_id),
    )
    .map((row) => ({
      id: row.user_id,
      email: row.email?.trim() || "Email unavailable",
      createdAt: row.created_at,
      lastSignInAt: row.last_sign_in_at,
      bannedUntil:
        row.banned_until && new Date(row.banned_until).getTime() > Date.now()
          ? row.banned_until
          : null,
      displayName: row.display_name?.trim() || "Unnamed user",
      role: row.role,
      isOwner: isOwnerEmail(row.email),
      planCode: null,
      subscriptionStatus: null,
      provider: null,
      billingInterval: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      betaVerified: false,
    }));
}

export function normalizeAdminCounts(
  overview: OverviewRpc | null | undefined,
): AdminCounts {
  return {
    users: toSafeCount(overview?.users),
    active7Days: toSafeCount(overview?.active_7_days),
    active30Days: toSafeCount(overview?.active_30_days),
    new7Days: toSafeCount(overview?.new_7_days),
    new30Days: toSafeCount(overview?.new_30_days),
    transactions: toSafeCount(overview?.transactions),
    bills: toSafeCount(overview?.bills),
    goals: toSafeCount(overview?.goals),
    debts: toSafeCount(overview?.debts),
    plannerRecords: toSafeCount(overview?.planner_records),
    storageObjects: toSafeCount(overview?.storage_objects),
  };
}

async function enrichSubscriptionState(users: AdminUserRow[]) {
  if (!users.length) return users;

  try {
    const service = createServiceClient() as any;
    const userIds = users.map((user) => user.id);
    const [subscriptionsResult, betaResult] = await Promise.all([
      service
        .from("subscriptions")
        .select(
          "user_id,plan_code,status,provider,billing_interval,current_period_end,cancel_at_period_end",
        )
        .in("user_id", userIds),
      service
        .from("beta_user_entitlements")
        .select("user_id")
        .in("user_id", userIds),
    ]);

    if (subscriptionsResult.error) {
      console.error("Admin subscription directory enrichment failed", {
        code: subscriptionsResult.error.code,
      });
      return users;
    }

    if (betaResult.error) {
      console.error("Admin Beta entitlement directory enrichment failed", {
        code: betaResult.error.code,
      });
    }

    const subscriptionMap = new Map<string, SubscriptionRow>(
      ((subscriptionsResult.data ?? []) as SubscriptionRow[]).map((row) => [
        row.user_id,
        row,
      ]),
    );
    const betaVerified = new Set(
      ((betaResult.data ?? []) as BetaEntitlementRow[]).map((row) => row.user_id),
    );

    return users.map((user) => {
      const subscription = subscriptionMap.get(user.id);
      if (!subscription) return user;

      return {
        ...user,
        planCode: subscription.plan_code,
        subscriptionStatus: subscription.status,
        provider: subscription.provider,
        billingInterval: subscription.billing_interval,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
        betaVerified: betaVerified.has(user.id),
      };
    });
  } catch (error) {
    console.error("Admin subscription directory enrichment could not initialize", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return users;
  }
}

export async function loadAdminDirectorySnapshot(supabase: SupabaseClient) {
  const [directoryResult, overviewResult] = await Promise.all([
    supabase.rpc("admin_account_directory"),
    supabase.rpc("admin_platform_overview"),
  ]);

  const normalizedUsers = normalizeAdminDirectory(
    (directoryResult.data ?? []) as DirectoryRpcRow[],
  );

  return {
    users: await enrichSubscriptionState(normalizedUsers),
    counts: normalizeAdminCounts(overviewResult.data as OverviewRpc | null),
    errors: {
      directory: directoryResult.error,
      overview: overviewResult.error,
    },
  };
}
