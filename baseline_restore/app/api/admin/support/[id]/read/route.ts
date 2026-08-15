import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "This request could not be verified." }, { status: 403, headers: noStoreHeaders() });
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Admin access is required." }, { status: 403, headers: noStoreHeaders() });
  const { id } = await context.params;
  const service = createServiceClient();
  const { error } = await service.from("support_requests").update({ admin_last_read_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: "The conversation could not be marked as read." }, { status: 500, headers: noStoreHeaders() });
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
