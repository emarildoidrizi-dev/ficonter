import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { loadSupportRequest } from "@/lib/admin/support";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { validateSupportMessage } from "@/lib/supportMessaging";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "This request could not be verified." }, { status: 403, headers: noStoreHeaders() });
  try {
    const { user, admin } = await requireAdmin();
    if (!user || !admin) return NextResponse.json({ error: "Admin access is required." }, { status: 403, headers: noStoreHeaders() });
    const { id } = await context.params;
    const payload = await request.json().catch(() => null) as { body?: unknown; internalNote?: unknown } | null;
    const validated = validateSupportMessage(payload?.body);
    if (!id || !validated.ok) return NextResponse.json({ error: validated.ok ? "Choose a support conversation." : validated.error }, { status: 400, headers: noStoreHeaders() });
    const supportRequest = await loadSupportRequest(id);
    if (!supportRequest) return NextResponse.json({ error: "The support conversation was not found." }, { status: 404, headers: noStoreHeaders() });

    const internalNote = payload?.internalNote === true;
    const service = createServiceClient();
    const { error: insertError } = await service.from("support_messages").insert({
      request_id: id,
      sender_user_id: user.id,
      sender_role: "admin",
      body: validated.body,
      internal_note: internalNote,
    });
    if (insertError) throw insertError;

    await service.from("support_requests").update({
      handled_by: user.id,
      admin_last_read_at: new Date().toISOString(),
      ...(internalNote ? {} : { status: "in_progress" }),
    }).eq("id", id);

    if (!internalNote) {
      await service.from("user_notifications").insert({
        user_id: supportRequest.userId,
        kind: "support_reply",
        title: "FICONTER Support replied",
        body: `A new reply is available for ${supportRequest.reference}.`,
        href: `/dashboard/inbox?thread=${id}`,
        metadata: { request_id: id, reference: supportRequest.reference },
      });
    }

    const updated = await loadSupportRequest(id);
    return NextResponse.json({ request: updated }, { status: 201, headers: noStoreHeaders() });
  } catch (error) {
    console.error("Admin support reply failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "The reply could not be sent." }, { status: 500, headers: noStoreHeaders() });
  }
}
