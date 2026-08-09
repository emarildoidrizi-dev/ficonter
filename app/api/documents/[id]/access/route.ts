import { NextRequest, NextResponse } from "next/server";
import { DOCUMENT_BUCKET } from "@/lib/documentVault";
import { noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { subscriptionApiAccessError } from "@/lib/subscriptionApiAccess";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const subscriptionAccessError = await subscriptionApiAccessError("financial_documents");
  if (subscriptionAccessError) return subscriptionAccessError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: noStoreHeaders() });
  const { id } = await context.params;
  const service = createServiceClient();
  const { data, error } = await service.from("financial_documents").select("storage_path,original_name,mime_type").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "The document was not found." }, { status: 404, headers: noStoreHeaders() });
  const download = request.nextUrl.searchParams.get("download") === "1";
  const { data: signed, error: signedError } = await service.storage.from(DOCUMENT_BUCKET).createSignedUrl(data.storage_path, 300, download ? { download: data.original_name } : undefined);
  if (signedError || !signed) return NextResponse.json({ error: "Secure access could not be created." }, { status: 500, headers: noStoreHeaders() });
  return NextResponse.json({ url: signed.signedUrl, mimeType: data.mime_type, expiresIn: 300 }, { headers: noStoreHeaders() });
}
