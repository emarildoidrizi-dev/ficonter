import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "This request could not be verified." }, { status: 403, headers: noStoreHeaders() });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: noStoreHeaders() });
  const { id } = await context.params;
  const { data: ownedThread, error: ownershipError } = await supabase
    .from("support_requests")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownershipError) {
    return NextResponse.json({ error: "The conversation could not be marked as read." }, { status: 500, headers: noStoreHeaders() });
  }
  if (!ownedThread) {
    return NextResponse.json({ error: "This support conversation was not found." }, { status: 404, headers: noStoreHeaders() });
  }

  const now = new Date().toISOString();
  const service = createServiceClient();
  const [{ error: requestError }, { error: notificationError }] = await Promise.all([
    service
      .from("support_requests")
      .update({ customer_last_read_at: now })
      .eq("id", id)
      .eq("user_id", user.id),
    service
      .from("user_notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .eq("href", `/dashboard/inbox?thread=${id}`)
      .in("kind", ["support_reply", "support_status"])
      .is("read_at", null),
  ]);

  if (requestError || notificationError) {
    return NextResponse.json({ error: "The conversation could not be marked as read." }, { status: 500, headers: noStoreHeaders() });
  }

  return NextResponse.json({ ok: true, readAt: now }, { headers: noStoreHeaders() });
}
