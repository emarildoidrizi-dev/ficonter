export const OWNER_MUSIC_BUCKET = "owner-music";
export const MAX_OWNER_TRACK_BYTES = 50 * 1024 * 1024;
export const OWNER_MUSIC_SIGNED_URL_SECONDS = 60 * 60 * 6;
export const OWNER_MUSIC_MAX_TRACKS = 100;

export const OWNER_MUSIC_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
  "audio/x-flac",
]);

export const OWNER_MUSIC_BUCKET_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
  "audio/x-flac",
] as const;

export function safeMusicFileName(value: string): string {
  const trimmed = value.trim().slice(0, 180);
  const safe = trimmed
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._()\- ]+/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();

  return safe || "track";
}

export function displayTrackTitle(storageName: string): string {
  const withoutPrefix = storageName.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}--/i,
    "",
  );
  const withoutExtension = withoutPrefix.replace(/\.[a-z0-9]{2,5}$/i, "");
  return withoutExtension.replace(/[_]+/g, " ").trim() || "Untitled track";
}

export function normalizeOwnerMusicMimeType(
  fileName: string,
  mimeType: string,
): string {
  const normalized = mimeType.trim().toLowerCase();
  if (OWNER_MUSIC_MIME_TYPES.has(normalized)) return normalized;

  const extension = fileName.trim().toLowerCase().split(".").pop() ?? "";
  const byExtension: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    aac: "audio/aac",
    wav: "audio/wav",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    webm: "audio/webm",
    flac: "audio/flac",
  };
  return byExtension[extension] ?? "";
}
