import { NextRequest, NextResponse } from "next/server";
import {
  DOCUMENT_BUCKET,
  MAX_DOCUMENT_BYTES,
} from "@/lib/documentVault";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { subscriptionApiAccessError } from "@/lib/subscriptionApiAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ENCRYPTION_OVERHEAD_BYTES = 64;

type ExpiredIntent = {
  id: string;
  storage_path: string;
};

async function removeExpiredUploadIntents(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await service
    .from("document_upload_intents")
    .select("id,storage_path")
    .eq("user_id", userId)
    .lt("expires_at", now)
    .limit(100);
  if (error) throw error;

  const expired = (data ?? []) as ExpiredIntent[];
  if (!expired.length) return;

  const paths = expired.map((item) => item.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: removeError } = await service.storage.from(DOCUMENT_BUCKET).remove(paths);
    if (removeError) {
      console.warn("Expired encrypted document objects could not all be removed", {
        userId,
        message: removeError.message,
      });
    }
  }

  const { error: deleteError } = await service
    .from("document_upload_intents")
    .delete()
    .eq("user_id", userId)
    .in("id", expired.map((item) => item.id));
  if (deleteError) throw deleteError;
}

function reservationErrorResponse(message: string): NextResponse | null {
  if (message.includes("document_vault_quota_exceeded")) {
    return NextResponse.json(
      { error: "Your private Document Vault has reached its 100 MB development limit." },
      { status: 413, headers: noStoreHeaders() },
    );
  }
  if (message.includes("too_many_pending_document_uploads")) {
    return NextResponse.json(
      { error: "Too many uploads are already being prepared. Wait a moment and try again." },
      { status: 429, headers: noStoreHeaders() },
    );
  }
  return null;
}

export async function POST(request: NextRequest) {
  const subscriptionAccessError = await subscriptionApiAccessError("financial_documents");
  if (subscriptionAccessError) return subscriptionAccessError;
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "This request could not be verified." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in again before uploading." },
        { status: 401, headers: noStoreHeaders() },
      );
    }

    const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const documentId = typeof payload?.documentId === "string" ? payload.documentId : "";
    const sizeBytes = Number(payload?.sizeBytes);
    const encryptedPayload = payload?.encryptedPayload;

    if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
      return NextResponse.json({ error: "The encrypted document ID is invalid." }, { status: 400, headers: noStoreHeaders() });
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_DOCUMENT_BYTES + ENCRYPTION_OVERHEAD_BYTES) {
      return NextResponse.json({ error: "The encrypted document must represent a file smaller than 10 MB." }, { status: 400, headers: noStoreHeaders() });
    }
    if (!encryptedPayload || typeof encryptedPayload !== "object") {
      return NextResponse.json({ error: "Encrypted document metadata is required." }, { status: 400, headers: noStoreHeaders() });
    }

    const service = createServiceClient();
    await removeExpiredUploadIntents(service, user.id);

    const storagePath = `${user.id}/${documentId}.ficonter`;
    const { data: intentId, error: reservationError } = await service.rpc("reserve_document_upload_e2ee", {
      p_user_id: user.id,
      p_document_id: documentId,
      p_storage_path: storagePath,
      p_size_bytes: sizeBytes,
      p_encrypted_payload: encryptedPayload,
    });

    if (reservationError || typeof intentId !== "string") {
      const handled = reservationErrorResponse(reservationError?.message ?? "");
      if (handled) return handled;
      throw reservationError ?? new Error("Missing encrypted upload reservation");
    }

    const { data: signed, error: signedError } = await service.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (signedError || !signed?.token) {
      await service.from("document_upload_intents").delete().eq("id", intentId).eq("user_id", user.id);
      throw signedError ?? new Error("Missing signed upload token");
    }

    return NextResponse.json(
      { intentId, path: storagePath, token: signed.token },
      { status: 201, headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("Encrypted document upload intent failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "A secure encrypted upload could not be prepared." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
