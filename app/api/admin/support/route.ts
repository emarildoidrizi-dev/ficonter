import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { loadSupportRequests } from "@/lib/admin/support";
import { noStoreHeaders } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user, admin } = await requireAdmin();

    if (!user || !admin) {
      return NextResponse.json(
        { error: "Admin access is required." },
        { status: 403, headers: noStoreHeaders() },
      );
    }

    const requests = await loadSupportRequests();
    return NextResponse.json({ requests }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("Support inbox refresh failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "The support inbox could not be refreshed." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
