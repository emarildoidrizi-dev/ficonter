import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "This request could not be verified." }, { status: 403, headers: noStoreHeaders() });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: noStoreHeaders() });
  const { id } = await context.params;
  const { error } = await supabase.from("support_requests").update({ customer_last_read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "The conversation could not be marked as read." }, { status: 500, headers: noStoreHeaders() });
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
