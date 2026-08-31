import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { noStoreHeaders } from "@/lib/security/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATABASE_TIMEOUT_MS = 4_000;

function timingSafeEqualText(left: string, right: string) {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

async function checkDatabase() {
  const startedAt = performance.now();
  const service = createServiceClient();

  const query = service
    .from("subscriptions")
    .select("user_id", { head: true, count: "estimated" });

  const timeout = new Promise<never>((_, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Database health check timed out.")),
      DATABASE_TIMEOUT_MS,
    );
    timer.unref?.();
  });

  const { error } = await Promise.race([query, timeout]);
  if (error) throw error;

  return Math.max(0, Math.round(performance.now() - startedAt));
}

export async function GET(request: NextRequest) {
  const checkedAt = new Date().toISOString();
  const deep = request.nextUrl.searchParams.get("deep") === "1";

  if (!deep) {
    return NextResponse.json(
      {
        service: "ficonter-web",
        status: "healthy",
        checkedAt,
      },
      { headers: noStoreHeaders() },
    );
  }

  const configuredToken = process.env.FICONTER_HEALTH_TOKEN?.trim();
  const suppliedToken = request.headers.get("x-ficonter-health-token")?.trim();

  if (
    !configuredToken ||
    !suppliedToken ||
    !timingSafeEqualText(configuredToken, suppliedToken)
  ) {
    return NextResponse.json(
      {
        service: "ficonter-web",
        status: "unauthorized",
        checkedAt,
      },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  try {
    const databaseLatencyMs = await checkDatabase();

    return NextResponse.json(
      {
        service: "ficonter-web",
        status: "healthy",
        checkedAt,
        dependencies: {
          database: {
            status: "healthy",
            latencyMs: databaseLatencyMs,
          },
        },
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("Deep health check failed", {
      dependency: "database",
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        service: "ficonter-web",
        status: "degraded",
        checkedAt,
        dependencies: {
          database: {
            status: "unavailable",
          },
        },
      },
      { status: 503, headers: noStoreHeaders() },
    );
  }
}
