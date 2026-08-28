import { NextRequest, NextResponse } from "next/server";
import { DOCUMENT_BUCKET } from "@/lib/documentVault";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { subscriptionApiAccessError } from "@/lib/subscriptionApiAccess";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const subscriptionAccessError = await subscriptionApiAccessError("financial_documents");
  if (subscriptionAccessError) return subscriptionAccessError;
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "This request could not be verified." }, { status: 403, headers: noStoreHeaders() });
  }

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: noStoreHeaders() });

  const { id } = await context.params;
  const payload = await request.json().catch(() => null) as { encryptedPayload?: unknown; expectedRevision?: unknown } | null;
  if (!payload?.encryptedPayload || typeof payload.encryptedPayload !== "object") {
    return NextResponse.json({ error: "Encrypted document metadata is required." }, { status: 400, headers: noStoreHeaders() });
  }

  const expectedRevision = Number(payload.expectedRevision ?? 0);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return NextResponse.json({ error: "The document revision is invalid." }, { status: 400, headers: noStoreHeaders() });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("financial_documents")
    .update({
      encrypted_payload: payload.encryptedPayload,
      encryption_version: 1,
      file_encryption_version: 1,
      e2ee_revision: expectedRevision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("e2ee_revision", expectedRevision)
    .select("id,user_id,size_bytes,encrypted_payload,encryption_version,file_encryption_version,e2ee_revision,created_at,updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "The encrypted document details could not be updated." }, { status: 500, headers: noStoreHeaders() });
  }
  if (!data) {
    return NextResponse.json({ error: "The document changed in another session. Reload and try again." }, { status: 409, headers: noStoreHeaders() });
  }

  return NextResponse.json({ document: data }, { headers: noStoreHeaders() });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const subscriptionAccessError = await subscriptionApiAccessError("financial_documents");
  if (subscriptionAccessError) return subscriptionAccessError;
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "This request could not be verified." }, { status: 403, headers: noStoreHeaders() });
  }

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: noStoreHeaders() });

  const { id } = await context.params;
  const service = createServiceClient();
  const { data, error: findError } = await service
    .from("financial_documents")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: "The document could not be verified." }, { status: 500, headers: noStoreHeaders() });
  }
  if (!data) {
    return NextResponse.json({ error: "The document was not found." }, { status: 404, headers: noStoreHeaders() });
  }

  const { error: storageError } = await service.storage.from(DOCUMENT_BUCKET).remove([data.storage_path]);
  if (storageError) {
    return NextResponse.json({ error: "The encrypted stored file could not be deleted." }, { status: 500, headers: noStoreHeaders() });
  }

  const { error: deleteError } = await service.from("financial_documents").delete().eq("id", id).eq("user_id", user.id);
  if (deleteError) {
    return NextResponse.json({ error: "The document record could not be deleted." }, { status: 500, headers: noStoreHeaders() });
  }

  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
