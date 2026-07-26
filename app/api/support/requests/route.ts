import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { supportReference, validateSupportRequestInput } from "@/lib/support";

export const dynamic = "force-dynamic";
const MAX_REQUESTS_PER_HOUR = 5;

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "This request could not be verified." }, { status: 403, headers: noStoreHeaders() });
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Sign in again before contacting support." }, { status: 401, headers: noStoreHeaders() });
    }

    const payload = await request.json().catch(() => null);
    const validated = validateSupportRequestInput(payload);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400, headers: noStoreHeaders() });
    }

    const service = createServiceClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await service
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);
    if (countError) throw countError;
    if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
      return NextResponse.json({ error: "You have already sent several requests recently. Please wait before submitting another concern." }, { status: 429, headers: { ...noStoreHeaders(), "Retry-After": "3600" } });
    }

    const { data: created, error: createError } = await service
      .from("support_requests")
      .insert({
        user_id: user.id,
        contact_email: validated.data.email,
        category: validated.data.category,
        subject: validated.data.subject,
        message: validated.data.message,
        customer_last_read_at: new Date().toISOString(),
      })
      .select("id,contact_email,created_at")
      .single();
    if (createError || !created) throw createError ?? new Error("Missing support request");

    const { error: messageError } = await service.from("support_messages").insert({
      request_id: created.id,
      sender_user_id: user.id,
      sender_role: "customer",
      body: validated.data.message,
      is_initial: true,
    });
    if (messageError) {
      await service.from("support_requests").delete().eq("id", created.id);
      throw messageError;
    }

    return NextResponse.json({
      reference: supportReference(created.id),
      email: created.contact_email,
      submittedAt: created.created_at,
      threadId: created.id,
    }, { status: 201, headers: noStoreHeaders() });
  } catch (error) {
    console.error("Support request endpoint failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "Support is temporarily unavailable. Please try again shortly." }, { status: 500, headers: noStoreHeaders() });
  }
}
