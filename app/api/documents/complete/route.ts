import { NextRequest, NextResponse } from "next/server";
import { DOCUMENT_BUCKET, hasValidDocumentSignature } from "@/lib/documentVault";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type IntentRow = {
  id: string;
  user_id: string;
  storage_path: string;
  original_name: string;
  display_name: string;
  category: string;
  mime_type: string;
  size_bytes: number;
  document_date: string | null;
  notes: string | null;
  expires_at: string;
};

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "This request could not be verified." }, { status: 403, headers: noStoreHeaders() });
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: noStoreHeaders() });
    const payload = await request.json().catch(() => null) as { intentId?: unknown } | null;
    if (typeof payload?.intentId !== "string") return NextResponse.json({ error: "The upload could not be verified." }, { status: 400, headers: noStoreHeaders() });
    const service = createServiceClient();
    const { data, error } = await service.from("document_upload_intents").select("*").eq("id", payload.intentId).eq("user_id", user.id).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "The upload session was not found." }, { status: 404, headers: noStoreHeaders() });
    const intent = data as IntentRow;
    if (new Date(intent.expires_at).getTime() <= Date.now()) {
      await service.storage.from(DOCUMENT_BUCKET).remove([intent.storage_path]);
      await service.from("document_upload_intents").delete().eq("id", intent.id);
      return NextResponse.json({ error: "The upload session expired. Please upload the file again." }, { status: 410, headers: noStoreHeaders() });
    }

    const { data: downloaded, error: downloadError } = await service.storage.from(DOCUMENT_BUCKET).download(intent.storage_path);
    if (downloadError || !downloaded) return NextResponse.json({ error: "The uploaded file could not be verified." }, { status: 400, headers: noStoreHeaders() });
    const bytes = new Uint8Array(await downloaded.arrayBuffer());
    if (bytes.byteLength !== Number(intent.size_bytes) || !hasValidDocumentSignature(bytes, intent.mime_type)) {
      await service.storage.from(DOCUMENT_BUCKET).remove([intent.storage_path]);
      await service.from("document_upload_intents").delete().eq("id", intent.id);
      return NextResponse.json({ error: "The uploaded file failed the document safety checks." }, { status: 400, headers: noStoreHeaders() });
    }

    const { data: created, error: insertError } = await service.from("financial_documents").insert({
      user_id: user.id,
      storage_path: intent.storage_path,
      original_name: intent.original_name,
      display_name: intent.display_name,
      category: intent.category,
      mime_type: intent.mime_type,
      size_bytes: intent.size_bytes,
      document_date: intent.document_date,
      notes: intent.notes,
    }).select("id,original_name,display_name,category,mime_type,size_bytes,document_date,notes,created_at,updated_at").single();
    if (insertError || !created) throw insertError ?? new Error("Missing document row");
    await service.from("document_upload_intents").delete().eq("id", intent.id);

    return NextResponse.json({ document: {
      id: created.id,
      originalName: created.original_name,
      displayName: created.display_name,
      category: created.category,
      mimeType: created.mime_type,
      sizeBytes: Number(created.size_bytes),
      documentDate: created.document_date,
      notes: created.notes,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    } }, { status: 201, headers: noStoreHeaders() });
  } catch (error) {
    console.error("Document upload completion failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "The document could not be finalized." }, { status: 500, headers: noStoreHeaders() });
  }
}
