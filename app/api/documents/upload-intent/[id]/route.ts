import { NextRequest, NextResponse } from "next/server";
import { DOCUMENT_BUCKET } from "@/lib/documentVault";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "This request could not be verified." }, { status: 403, headers: noStoreHeaders() });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: noStoreHeaders() });
  const { id } = await context.params;
  const service = createServiceClient();
  const { data } = await service.from("document_upload_intents").select("storage_path").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (data?.storage_path) await service.storage.from(DOCUMENT_BUCKET).remove([data.storage_path]);
  await service.from("document_upload_intents").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
