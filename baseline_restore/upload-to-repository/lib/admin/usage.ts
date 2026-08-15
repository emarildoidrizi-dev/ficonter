import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emptyPlatformUsageOverview,
  normalizePlatformUsageOverview,
  normalizePlatformUsageRows,
  type PlatformUsageOverview,
  type PlatformUsageRow,
  type UsageScope,
} from "@/lib/admin/usage-shared";

export type PlatformUsageSnapshot = {
  rows: PlatformUsageRow[];
  overview: PlatformUsageOverview;
  errors: {
    directory: string | null;
    overview: string | null;
  };
};

export async function loadPlatformUsageSnapshot(
  supabase: SupabaseClient,
  scope: UsageScope,
): Promise<PlatformUsageSnapshot> {
  const [directoryResult, overviewResult] = await Promise.all([
    supabase.rpc("admin_usage_directory", { p_scope: scope }),
    supabase.rpc("admin_usage_overview", { p_scope: scope }),
  ]);

  return {
    rows: normalizePlatformUsageRows(
      directoryResult.data as Record<string, unknown>[] | null,
    ),
    overview: overviewResult.error
      ? emptyPlatformUsageOverview
      : normalizePlatformUsageOverview(
          overviewResult.data as Record<string, unknown> | null,
        ),
    errors: {
      directory: directoryResult.error?.message ?? null,
      overview: overviewResult.error?.message ?? null,
    },
  };
}
