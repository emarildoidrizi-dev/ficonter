import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { updateSupportRequestStatus } from "@/lib/admin/support";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { isSupportStatus } from "@/lib/support";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "This request could not be verified." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  try {
    const { user, admin } = await requireAdmin();

    if (!user || !admin) {
      return NextResponse.json(
        { error: "Admin access is required." },
        { status: 403, headers: noStoreHeaders() },
      );
    }

    const { id } = await context.params;
    const payload = (await request.json().catch(() => null)) as {
      status?: unknown;
    } | null;

    if (!id || !payload || !isSupportStatus(payload.status)) {
      return NextResponse.json(
        { error: "Choose a valid support status." },
        { status: 400, headers: noStoreHeaders() },
      );
    }

    const updated = await updateSupportRequestStatus({
      requestId: id,
      status: payload.status,
      adminUserId: user.id,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "The support request was not found." },
        { status: 404, headers: noStoreHeaders() },
      );
    }

    return NextResponse.json(
      { request: updated },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("Support request update failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "The support request could not be updated." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
