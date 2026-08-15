import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validateSupportMessage } from "@/lib/supportMessaging";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "This request could not be verified." }, { status: 403, headers: noStoreHeaders() });
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Sign in again before replying." }, { status: 401, headers: noStoreHeaders() });
    }

    const { id } = await context.params;
    const payload = await request.json().catch(() => null) as { body?: unknown } | null;
    const validated = validateSupportMessage(payload?.body);
    if (!id || !validated.ok) {
      return NextResponse.json({ error: validated.ok ? "Choose a conversation." : validated.error }, { status: 400, headers: noStoreHeaders() });
    }

    const { data: thread, error: threadError } = await supabase
      .from("support_requests")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (threadError || !thread) {
      return NextResponse.json({ error: "This support conversation was not found." }, { status: 404, headers: noStoreHeaders() });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("request_id", id)
      .eq("sender_role", "customer")
      .gte("created_at", oneHourAgo);
    if (countError) throw countError;
    if ((count ?? 0) >= 20) {
      return NextResponse.json({ error: "Please wait before sending more messages." }, { status: 429, headers: { ...noStoreHeaders(), "Retry-After": "3600" } });
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from("support_messages")
      .insert({
        request_id: id,
        sender_user_id: user.id,
        sender_role: "customer",
        body: validated.body,
      })
      .select("id,request_id,sender_role,body,internal_note,created_at")
      .single();
    if (error || !data) throw error ?? new Error("Missing message row");

    await service
      .from("support_requests")
      .update({ customer_last_read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({
      message: {
        id: data.id,
        requestId: data.request_id,
        senderRole: data.sender_role,
        body: data.body,
        internalNote: data.internal_note,
        createdAt: data.created_at,
      },
    }, { status: 201, headers: noStoreHeaders() });
  } catch (error) {
    console.error("Customer support reply failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "Your reply could not be sent. Please try again." }, { status: 500, headers: noStoreHeaders() });
  }
}
