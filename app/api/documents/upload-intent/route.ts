import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  DOCUMENT_BUCKET,
  MAX_DOCUMENT_BYTES,
  isDocumentCategory,
  safeFileName,
} from "@/lib/documentVault";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  if (expired.length === 0) return;

  const paths = expired.map((item) => item.storage_path).filter(Boolean);
  if (paths.length > 0) {
    const { error: removeError } = await service.storage.from(DOCUMENT_BUCKET).remove(paths);
    if (removeError) {
      console.warn("Expired document objects could not all be removed", {
        userId,
        message: removeError.message,
      });
    }
  }

  const ids = expired.map((item) => item.id);
  const { error: deleteError } = await service
    .from("document_upload_intents")
    .delete()
    .eq("user_id", userId)
    .in("id", ids);
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
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "This request could not be verified." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in again before uploading." },
        { status: 401, headers: noStoreHeaders() },
      );
    }

    const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const originalName = typeof payload?.originalName === "string" ? payload.originalName.trim() : "";
    const displayName = typeof payload?.displayName === "string" ? payload.displayName.trim() : "";
    const mimeType = typeof payload?.mimeType === "string" ? payload.mimeType : "";
    const sizeBytes = Number(payload?.sizeBytes);
    const documentDate = typeof payload?.documentDate === "string" ? payload.documentDate.trim() : "";
    const notes = typeof payload?.notes === "string" ? payload.notes.trim() : "";

    if (!originalName || originalName.length > 255 || !displayName || displayName.length > 160) {
      return NextResponse.json(
        { error: "Review the document name and title." },
        { status: 400, headers: noStoreHeaders() },
      );
    }
    if (!isDocumentCategory(payload?.category)) {
      return NextResponse.json(
        { error: "Choose a document category." },
        { status: 400, headers: noStoreHeaders() },
      );
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: "Only PDF, JPG, PNG and WEBP documents are accepted." },
        { status: 400, headers: noStoreHeaders() },
      );
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_DOCUMENT_BYTES) {
      return NextResponse.json(
        { error: "The document must be smaller than 10 MB." },
        { status: 400, headers: noStoreHeaders() },
      );
    }
    if (notes.length > 1000 || (documentDate && !/^\d{4}-\d{2}-\d{2}$/.test(documentDate))) {
      return NextResponse.json(
        { error: "Review the document date and notes." },
        { status: 400, headers: noStoreHeaders() },
      );
    }

    const service = createServiceClient();
    await removeExpiredUploadIntents(service, user.id);

    const storagePath = `${user.id}/${randomUUID()}-${safeFileName(originalName)}`;
    const { data: intentId, error: reservationError } = await service.rpc("reserve_document_upload", {
      p_user_id: user.id,
      p_storage_path: storagePath,
      p_original_name: originalName,
      p_display_name: displayName,
      p_category: payload.category,
      p_mime_type: mimeType,
      p_size_bytes: sizeBytes,
      p_document_date: documentDate || undefined,
      p_notes: notes || undefined,
    });

    if (reservationError || typeof intentId !== "string") {
      const handled = reservationErrorResponse(reservationError?.message ?? "");
      if (handled) return handled;
      throw reservationError ?? new Error("Missing upload reservation");
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
    console.error("Document upload intent failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "A secure upload could not be prepared." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
