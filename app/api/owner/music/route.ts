import { NextRequest, NextResponse } from "next/server";
import {
  displayTrackTitle,
  OWNER_MUSIC_BUCKET,
  OWNER_MUSIC_MAX_TRACKS,
  OWNER_MUSIC_SIGNED_URL_SECONDS,
} from "@/lib/ownerMusic/config";
import {
  ensureOwnerMusicBucket,
  requirePlatformOwner,
} from "@/lib/ownerMusic/server";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StorageTrack = {
  id?: string | null;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

function unauthorized(status: 401 | 403) {
  return NextResponse.json(
    { error: status === 401 ? "Sign in again." : "Owner access only." },
    { status, headers: noStoreHeaders() },
  );
}

export async function GET() {
  const access = await requirePlatformOwner();
  if (!access.user || !access.service) return unauthorized(access.status);

  try {
    await ensureOwnerMusicBucket(access.service);
    const { data, error } = await access.service.storage
      .from(OWNER_MUSIC_BUCKET)
      .list(access.user.id, { limit: OWNER_MUSIC_MAX_TRACKS });

    if (error) throw error;

    const rows = ((data ?? []) as StorageTrack[])
      .filter((item) => item.name && item.name !== ".emptyFolderPlaceholder")
      .sort((a, b) => {
        const aTime = Date.parse(a.created_at ?? "") || 0;
        const bTime = Date.parse(b.created_at ?? "") || 0;
        return aTime === bTime
          ? a.name.localeCompare(b.name)
          : aTime - bTime;
      });

    const tracks = await Promise.all(
      rows.map(async (item) => {
        const path = `${access.user!.id}/${item.name}`;
        const { data: signed, error: signedError } = await access.service!.storage
          .from(OWNER_MUSIC_BUCKET)
          .createSignedUrl(path, OWNER_MUSIC_SIGNED_URL_SECONDS);
        if (signedError || !signed?.signedUrl) return null;

        const metadata = item.metadata ?? {};
        const size = Number(metadata.size ?? 0);
        const mimeType =
          typeof metadata.mimetype === "string"
            ? metadata.mimetype
            : typeof metadata.contentType === "string"
              ? metadata.contentType
              : "audio/mpeg";

        return {
          id: item.id || path,
          path,
          fileName: item.name,
          title: displayTrackTitle(item.name),
          sizeBytes: Number.isFinite(size) ? size : 0,
          mimeType,
          createdAt: item.created_at ?? item.updated_at ?? null,
          url: signed.signedUrl,
        };
      }),
    );

    return NextResponse.json(
      { tracks: tracks.filter(Boolean) },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("Owner music library could not be loaded", {
      userId: access.user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "The Owner music library could not be loaded." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "This request could not be verified." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  const access = await requirePlatformOwner();
  if (!access.user || !access.service) return unauthorized(access.status);

  const payload = (await request.json().catch(() => null)) as
    | { path?: unknown }
    | null;
  const path = typeof payload?.path === "string" ? payload.path.trim() : "";
  const prefix = `${access.user.id}/`;
  if (!path.startsWith(prefix) || path.includes("..") || path.length > 320) {
    return NextResponse.json(
      { error: "That track could not be verified." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  try {
    const { error } = await access.service.storage
      .from(OWNER_MUSIC_BUCKET)
      .remove([path]);
    if (error) throw error;

    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("Owner music track could not be deleted", {
      userId: access.user.id,
      path,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "The track could not be deleted." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
