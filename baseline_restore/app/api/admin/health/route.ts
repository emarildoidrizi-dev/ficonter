import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { loadPlatformHealth } from "@/lib/admin/health";
import { noStoreHeaders } from "@/lib/security/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { user, admin } = await requireAdmin();

    if (!user || !admin) {
      return NextResponse.json(
        { error: "Admin access is required." },
        { status: 403, headers: noStoreHeaders() },
      );
    }

    const health = await loadPlatformHealth();
    return NextResponse.json(health, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("Platform health endpoint failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "Platform health could not be checked." },
      { status: 503, headers: noStoreHeaders() },
    );
  }
}
