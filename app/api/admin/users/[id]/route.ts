import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { loadAdminDirectorySnapshot } from "@/lib/admin/snapshot";
import { noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

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

    const supabase = await createClient();
    const snapshot = await loadAdminDirectorySnapshot(supabase);

    if (snapshot.errors.directory || snapshot.errors.overview) {
      console.error("Admin directory refresh failed", {
        directoryCode: snapshot.errors.directory?.code,
        overviewCode: snapshot.errors.overview?.code,
      });

      return NextResponse.json(
        { error: "The account directory could not be refreshed." },
        { status: 503, headers: noStoreHeaders() },
      );
    }

    return NextResponse.json(
      { users: snapshot.users, counts: snapshot.counts },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("Admin directory refresh failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "The account directory could not be refreshed." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
