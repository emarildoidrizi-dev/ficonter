import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/access";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashCode(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function POST(request: NextRequest) {
  const headers = noStoreHeaders();

  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403, headers },
    );
  }

  const { user, error: userError } = await getCurrentUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Sign in before activating Beta access." },
      { status: 401, headers },
    );
  }

  // Owner / Super Admin / Admin are permanently subscription-exempt.
  // They never need Beta and must not be converted into customer plan records.
  const { admin } = await requireAdmin();
  if (admin) {
    return NextResponse.json(
      { error: "Administrative accounts already have full platform access." },
      { status: 409, headers },
    );
  }

  let payload: { code?: unknown };

  try {
    payload = (await request.json()) as { code?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400, headers },
    );
  }

  const code = typeof payload.code === "string" ? payload.code.trim() : "";

  if (!code || code.length > 160) {
    return NextResponse.json(
      { error: "Enter a valid Beta invitation code." },
      { status: 403, headers },
    );
  }

  const service = createServiceClient() as any;
  const { data, error } = await service.rpc(
    "activate_ficonter_beta_for_existing_user",
    {
      p_user_id: user.id,
      p_code_hash: hashCode(code),
    },
  );

  if (error) {
    const message = String(error.message ?? "");

    if (message.includes("ACTIVE_PAID_SUBSCRIPTION")) {
      return NextResponse.json(
        {
          error:
            "Your paid PayPal access is still active. Finish or cancel that paid period before switching this account to private Beta, so billing is not left running in the background.",
        },
        { status: 409, headers },
      );
    }

    console.error("Existing-account Beta activation failed", {
      userId: user.id,
      code: error.code,
    });

    return NextResponse.json(
      { error: "Beta access could not be activated. Please try again." },
      { status: 500, headers },
    );
  }

  if (data !== true) {
    return NextResponse.json(
      { error: "The Beta invitation code is invalid or no longer available." },
      { status: 403, headers },
    );
  }

  const response = NextResponse.json(
    { ok: true, planCode: "beta" },
    { status: 200, headers },
  );


  return response;
}
