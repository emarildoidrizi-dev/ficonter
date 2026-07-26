import { NextRequest, NextResponse } from "next/server";
import { DOCUMENT_BUCKET, isDocumentCategory } from "@/lib/documentVault";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "This request could not be verified." }, { status: 403, headers: noStoreHeaders() });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: noStoreHeaders() });
  const { id } = await context.params;
  const payload = await request.json().catch(() => null) as { displayName?: unknown; category?: unknown; documentDate?: unknown; notes?: unknown } | null;
  const displayName = typeof payload?.displayName === "string" ? payload.displayName.trim() : "";
  const notes = typeof payload?.notes === "string" ? payload.notes.trim() : "";
  const documentDate = typeof payload?.documentDate === "string" ? payload.documentDate.trim() : "";
  if (!displayName || displayName.length > 160 || !isDocumentCategory(payload?.category) || notes.length > 1000 || (documentDate && !/^\d{4}-\d{2}-\d{2}$/.test(documentDate))) {
    return NextResponse.json({ error: "Review the document details and try again." }, { status: 400, headers: noStoreHeaders() });
  }
  const service = createServiceClient();
  const { data, error } = await service.from("financial_documents").update({ display_name: displayName, category: payload.category, document_date: documentDate || null, notes: notes || null }).eq("id", id).eq("user_id", user.id).select("id,original_name,display_name,category,mime_type,size_bytes,document_date,notes,created_at,updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: "The document details could not be updated." }, { status: 500, headers: noStoreHeaders() });
  if (!data) return NextResponse.json({ error: "The document was not found." }, { status: 404, headers: noStoreHeaders() });
  return NextResponse.json({ document: {
    id: data.id, originalName: data.original_name, displayName: data.display_name, category: data.category, mimeType: data.mime_type, sizeBytes: Number(data.size_bytes), documentDate: data.document_date, notes: data.notes, createdAt: data.created_at, updatedAt: data.updated_at,
  } }, { headers: noStoreHeaders() });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "This request could not be verified." }, { status: 403, headers: noStoreHeaders() });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: noStoreHeaders() });
  const { id } = await context.params;
  const service = createServiceClient();
  const { data, error: findError } = await service.from("financial_documents").select("storage_path,display_name").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (findError) return NextResponse.json({ error: "The document could not be verified." }, { status: 500, headers: noStoreHeaders() });
  if (!data) return NextResponse.json({ error: "The document was not found." }, { status: 404, headers: noStoreHeaders() });
  const { error: storageError } = await service.storage.from(DOCUMENT_BUCKET).remove([data.storage_path]);
  if (storageError) return NextResponse.json({ error: "The stored file could not be deleted." }, { status: 500, headers: noStoreHeaders() });
  const { error: deleteError } = await service.from("financial_documents").delete().eq("id", id).eq("user_id", user.id);
  if (deleteError) return NextResponse.json({ error: "The document record could not be deleted." }, { status: 500, headers: noStoreHeaders() });
  await service.from("user_notifications").insert({ user_id: user.id, kind: "document_deleted", title: "Document deleted", body: `${data.display_name} was permanently removed from your vault.`, href: "/dashboard/documents", metadata: { document_id: id } });
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
