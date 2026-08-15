import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_TTL_MINUTES = 15;

function hashCode(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function constantTimeHexEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(left, "hex"),
      Buffer.from(right, "hex"),
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const headers = noStoreHeaders();

  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403, headers },
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
      { error: "The Beta invitation code is invalid." },
      { status: 403, headers },
    );
  }

  const codeHash = hashCode(code);
  const service = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: invite, error: inviteError } = await service
    .from("beta_invite_codes")
    .select("id,code_hash,active,max_uses,use_count,expires_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (
    inviteError ||
    !invite ||
    invite.active !== true ||
    !constantTimeHexEqual(codeHash, String(invite.code_hash ?? "")) ||
    (invite.expires_at && Date.parse(invite.expires_at) <= Date.now()) ||
    (typeof invite.max_uses === "number" &&
      Number(invite.use_count ?? 0) >= invite.max_uses)
  ) {
    return NextResponse.json(
      { error: "The Beta invitation code is invalid or no longer available." },
      { status: 403, headers },
    );
  }

  // Opportunistic cleanup. Failure here must not block a valid invite.
  await service
    .from("beta_signup_tokens")
    .delete()
    .lt("expires_at", nowIso)
    .not("consumed_at", "is", null);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_MINUTES * 60_000,
  ).toISOString();

  const { error: tokenError } = await service
    .from("beta_signup_tokens")
    .insert({
      token,
      invite_code_id: invite.id,
      expires_at: expiresAt,
    });

  if (tokenError) {
    return NextResponse.json(
      { error: "Beta access could not be prepared. Please try again." },
      { status: 500, headers },
    );
  }

  return NextResponse.json(
    { token, expiresAt },
    { status: 200, headers },
  );
}
