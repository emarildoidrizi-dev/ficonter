import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { isOwnerEmail } from "@/lib/admin/access";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RESTORE_AUTHORIZATION_MINUTES = 5;

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: noStoreHeaders() },
  );
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("This restore authorization request was rejected.", 403);
  }

  const { user } = await getCurrentUser();
  if (!user) return errorResponse("Authentication is required.", 401);
  if (!isOwnerEmail(user.email)) {
    return errorResponse("Only the FICONTER Owner can authorize backup restore.", 403);
  }

  const service = createServiceClient();
  const token = randomUUID();
  const expiresAt = new Date(
    Date.now() + RESTORE_AUTHORIZATION_MINUTES * 60 * 1000,
  ).toISOString();

  // Opportunistic cleanup. Failure here must not weaken or block issuance of the
  // current ticket because the database also enforces expiry on consumption.
  const cleanup = await service
    .from("owner_backup_restore_authorizations")
    .delete()
    .lt("expires_at", new Date().toISOString());

  if (cleanup.error) {
    console.warn("Expired Owner restore authorization cleanup failed", {
      code: cleanup.error.code,
    });
  }

  const { error } = await service
    .from("owner_backup_restore_authorizations")
    .insert({
      token,
      user_id: user.id,
      expires_at: expiresAt,
    });

  if (error) {
    console.error("Owner restore authorization issuance failed", {
      userId: user.id,
      code: error.code,
    });
    return errorResponse("Backup restore could not be authorized.", 500);
  }

  return NextResponse.json(
    {
      ok: true,
      authorization: token,
      expiresAt,
    },
    { headers: noStoreHeaders() },
  );
}
