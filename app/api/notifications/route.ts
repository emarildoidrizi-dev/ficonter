import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { loadSupportRequests } from "@/lib/admin/support";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const INCOMING_NOTIFICATION_KINDS = ["support_reply", "support_status", "system"] as const;

export async function GET() {
  try {
    const { user, admin } = await requireAdmin();
    if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: noStoreHeaders() });
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_notifications")
      .select("id,kind,title,body,href,read_at,created_at")
      .eq("user_id", user.id)
      .in("kind", [...INCOMING_NOTIFICATION_KINDS])
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    const notifications = ((data ?? []) as Array<{
      id: string;
      kind: "support_reply" | "support_status" | "system";
      title: string;
      body: string;
      href: string | null;
      read_at: string | null;
      created_at: string;
    }>).map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      body: item.body,
      href: item.href,
      readAt: item.read_at,
      createdAt: item.created_at,
    }));
    let adminSupportUnread = 0;
    if (admin) {
      const requests = await loadSupportRequests();
      adminSupportUnread = requests.reduce((sum, item) => sum + item.unreadCustomerMessages, 0);
    }
    return NextResponse.json({
      notifications,
      unreadCount: notifications.filter((item) => !item.readAt).length,
      adminSupportUnread,
    }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("Notifications load failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "Notifications could not be loaded." }, { status: 500, headers: noStoreHeaders() });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "This request could not be verified." }, { status: 403, headers: noStoreHeaders() });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: noStoreHeaders() });
  const payload = await request.json().catch(() => null) as { id?: unknown; all?: unknown } | null;
  let query = supabase.from("user_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (payload?.all !== true) {
    if (typeof payload?.id !== "string") return NextResponse.json({ error: "Choose a notification." }, { status: 400, headers: noStoreHeaders() });
    query = query.eq("id", payload.id);
  }
  const { error } = await query;
  if (error) return NextResponse.json({ error: "The notification could not be updated." }, { status: 500, headers: noStoreHeaders() });
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
