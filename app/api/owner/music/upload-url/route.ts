import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  MAX_OWNER_TRACK_BYTES,
  OWNER_MUSIC_BUCKET,
  OWNER_MUSIC_MAX_TRACKS,
  OWNER_MUSIC_MIME_TYPES,
  normalizeOwnerMusicMimeType,
  safeMusicFileName,
} from "@/lib/ownerMusic/config";
import {
  ensureOwnerMusicBucket,
  requirePlatformOwner,
} from "@/lib/ownerMusic/server";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "This request could not be verified." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  const access = await requirePlatformOwner();
  if (!access.user || !access.service) {
    return NextResponse.json(
      { error: access.status === 401 ? "Sign in again." : "Owner access only." },
      { status: access.status, headers: noStoreHeaders() },
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | { fileName?: unknown; mimeType?: unknown; sizeBytes?: unknown }
    | null;
  const fileName =
    typeof payload?.fileName === "string" ? payload.fileName.trim() : "";
  const mimeType =
    typeof payload?.mimeType === "string" ? payload.mimeType.trim() : "";
  const sizeBytes = Number(payload?.sizeBytes);

  if (!fileName || fileName.length > 180) {
    return NextResponse.json(
      { error: "Choose a valid audio file." },
      { status: 400, headers: noStoreHeaders() },
    );
  }
  const acceptedMimeType = normalizeOwnerMusicMimeType(fileName, mimeType);
  if (!acceptedMimeType || !OWNER_MUSIC_MIME_TYPES.has(acceptedMimeType)) {
    return NextResponse.json(
      { error: "Use an MP3, M4A, AAC, WAV, OGG, WEBM or FLAC audio file." },
      { status: 400, headers: noStoreHeaders() },
    );
  }
  if (
    !Number.isFinite(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > MAX_OWNER_TRACK_BYTES
  ) {
    return NextResponse.json(
      { error: "Each music file must be 50 MB or smaller." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  try {
    await ensureOwnerMusicBucket(access.service);

    const { data: existing, error: listError } = await access.service.storage
      .from(OWNER_MUSIC_BUCKET)
      .list(access.user.id, { limit: OWNER_MUSIC_MAX_TRACKS + 1 });
    if (listError) throw listError;
    if ((existing ?? []).length >= OWNER_MUSIC_MAX_TRACKS) {
      return NextResponse.json(
        { error: `Owner Music currently supports up to ${OWNER_MUSIC_MAX_TRACKS} tracks.` },
        { status: 413, headers: noStoreHeaders() },
      );
    }

    const path = `${access.user.id}/${randomUUID()}--${safeMusicFileName(fileName)}`;
    const { data, error } = await access.service.storage
      .from(OWNER_MUSIC_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data?.token) throw error ?? new Error("Missing upload token");

    return NextResponse.json(
      { bucket: OWNER_MUSIC_BUCKET, path, token: data.token, mimeType: acceptedMimeType },
      { status: 201, headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("Owner music upload could not be prepared", {
      userId: access.user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "The secure music upload could not be prepared." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
