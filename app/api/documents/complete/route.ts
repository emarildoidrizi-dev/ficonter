import { NextRequest, NextResponse } from "next/server";
import { DOCUMENT_BUCKET } from "@/lib/documentVault";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { subscriptionApiAccessError } from "@/lib/subscriptionApiAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FILE_MAGIC = new TextEncoder().encode("FICONTER-DOC-V1\0");

type IntentRow = {
  id: string;
  user_id: string;
  document_id: string;
  storage_path: string;
  size_bytes: number;
  encrypted_payload: Record<string, unknown>;
  encryption_version: number;
  file_encryption_version: number;
  expires_at: string;
};

function hasEncryptedDocumentMagic(bytes: Uint8Array) {
  if (bytes.length < FILE_MAGIC.length + 12 + 16) return false;
  return FILE_MAGIC.every((value, index) => bytes[index] === value);
}

export async function POST(request: NextRequest) {
  const subscriptionAccessError = await subscriptionApiAccessError("financial_documents");
  if (subscriptionAccessError) return subscriptionAccessError;
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "This request could not be verified." }, { status: 403, headers: noStoreHeaders() });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: noStoreHeaders() });

    const payload = await request.json().catch(() => null) as { intentId?: unknown } | null;
    if (typeof payload?.intentId !== "string") {
      return NextResponse.json({ error: "The upload could not be verified." }, { status: 400, headers: noStoreHeaders() });
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from("document_upload_intents")
      .select("id,user_id,document_id,storage_path,size_bytes,encrypted_payload,encryption_version,file_encryption_version,expires_at")
      .eq("id", payload.intentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "The upload session was not found." }, { status: 404, headers: noStoreHeaders() });
    }

    const intent = data as IntentRow;
    if (new Date(intent.expires_at).getTime() <= Date.now()) {
      await service.storage.from(DOCUMENT_BUCKET).remove([intent.storage_path]);
      await service.from("document_upload_intents").delete().eq("id", intent.id);
      return NextResponse.json({ error: "The upload session expired. Please upload the file again." }, { status: 410, headers: noStoreHeaders() });
    }

    const { data: encryptedFile, error: downloadError } = await service.storage
      .from(DOCUMENT_BUCKET)
      .download(intent.storage_path);
    if (downloadError || !encryptedFile) {
      return NextResponse.json({ error: "The encrypted upload could not be verified." }, { status: 400, headers: noStoreHeaders() });
    }

    const bytes = new Uint8Array(await encryptedFile.arrayBuffer());
    if (bytes.byteLength !== Number(intent.size_bytes) || !hasEncryptedDocumentMagic(bytes)) {
      await service.storage.from(DOCUMENT_BUCKET).remove([intent.storage_path]);
      await service.from("document_upload_intents").delete().eq("id", intent.id);
      return NextResponse.json({ error: "The encrypted upload failed its integrity format checks." }, { status: 400, headers: noStoreHeaders() });
    }

    const { data: created, error: insertError } = await service
      .from("financial_documents")
      .insert({
        id: intent.document_id,
        user_id: user.id,
        storage_path: intent.storage_path,
        size_bytes: intent.size_bytes,
        encrypted_payload: intent.encrypted_payload,
        encryption_version: 1,
        file_encryption_version: 1,
      })
      .select("id,user_id,size_bytes,encrypted_payload,encryption_version,file_encryption_version,e2ee_revision,created_at,updated_at")
      .single();
    if (insertError || !created) throw insertError ?? new Error("Missing encrypted document row");

    await service.from("document_upload_intents").delete().eq("id", intent.id);

    return NextResponse.json(
      { document: created },
      { status: 201, headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("Encrypted document upload completion failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "The encrypted document could not be finalized." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
