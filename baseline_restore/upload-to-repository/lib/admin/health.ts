import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";
import type {
  HealthCheck,
  HealthServiceKey,
  PlatformHealthSnapshot,
} from "@/lib/admin/health-shared";

const CHECK_TIMEOUT_MS = 6_000;
const DEGRADED_LATENCY_MS = 2_500;

type CheckRunner = () => Promise<void>;

function unavailableCheck(checkedAt: string): HealthCheck {
  return {
    status: "offline",
    latencyMs: null,
    checkedAt,
    message: "The service check could not be completed.",
  };
}

async function runTimedCheck(
  service: Exclude<HealthServiceKey, "realtime">,
  runner: CheckRunner,
): Promise<HealthCheck> {
  const startedAt = performance.now();
  const checkedAt = new Date().toISOString();
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    await Promise.race([
      runner(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${service.toUpperCase()}_CHECK_TIMEOUT`)),
          CHECK_TIMEOUT_MS,
        );
      }),
    ]);

    const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
    const degraded = latencyMs >= DEGRADED_LATENCY_MS;

    return {
      status: degraded ? "degraded" : "healthy",
      latencyMs,
      checkedAt,
      message: degraded
        ? "The service responded, but more slowly than expected."
        : "The service responded normally.",
    };
  } catch (error) {
    console.error("Platform health check failed", {
      service,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return unavailableCheck(checkedAt);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function loadPlatformHealth(): Promise<PlatformHealthSnapshot> {
  const checkedAt = new Date().toISOString();

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch (error) {
    console.error("Platform health client initialization failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    const offline = unavailableCheck(checkedAt);
    return {
      checkedAt,
      services: {
        auth: offline,
        database: offline,
        storage: offline,
        realtime: {
          status: "degraded",
          latencyMs: null,
          checkedAt,
          message: "Waiting for a live Realtime connection check.",
        },
      },
    };
  }

  const [auth, database, storage] = await Promise.all([
    runTimedCheck("auth", async () => {
      const { error } = await service.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });
      if (error) throw error;
    }),
    runTimedCheck("database", async () => {
      const { error } = await service
        .from("admin_users")
        .select("user_id", { count: "exact", head: true });
      if (error) throw error;
    }),
    runTimedCheck("storage", async () => {
      const { error } = await service.storage.listBuckets();
      if (error) throw error;
    }),
  ]);

  return {
    checkedAt,
    services: {
      auth,
      database,
      storage,
      realtime: {
        status: "degraded",
        latencyMs: null,
        checkedAt,
        message: "Waiting for a live Realtime connection check.",
      },
    },
  };
}
