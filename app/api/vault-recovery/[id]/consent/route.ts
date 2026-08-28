import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function privacyHash(value: string | null) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { signature?: string };
    const signature = String(body.signature ?? "").trim();

    const forwardedFor = request.headers.get("x-forwarded-for");
    const clientIp = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    const service = createServiceClient() as any;
    const { data, error } = await service.rpc("customer_submit_vault_recovery_consent", {
      p_recovery_request_id: id,
      p_user_id: user.id,
      p_signature: signature,
      p_ip_hash: privacyHash(clientIp),
      p_user_agent_hash: privacyHash(userAgent),
    });

    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      signedAt: result?.signed_at ?? null,
      documentId: result?.document_id ?? null,
    });
  } catch (error) {
    console.error("Customer recovery consent submission failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The signed consent could not be submitted." },
      { status: 400 },
    );
  }
}
