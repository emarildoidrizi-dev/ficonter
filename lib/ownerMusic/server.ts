import "server-only";

import { isOwnerEmail } from "@/lib/admin/access";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_OWNER_TRACK_BYTES,
  OWNER_MUSIC_BUCKET,
  OWNER_MUSIC_BUCKET_MIME_TYPES,
} from "@/lib/ownerMusic/config";

export async function requirePlatformOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, service: null, status: 401 as const };
  if (!isOwnerEmail(user.email)) {
    return { user, service: null, status: 403 as const };
  }
  return { user, service: createServiceClient(), status: 200 as const };
}

const bucketOptions = {
  public: false,
  fileSizeLimit: MAX_OWNER_TRACK_BYTES,
  allowedMimeTypes: [...OWNER_MUSIC_BUCKET_MIME_TYPES],
};

export async function ensureOwnerMusicBucket(
  service: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const { data, error } = await service.storage.getBucket(OWNER_MUSIC_BUCKET);

  if (data && !error) {
    // Owner music must never become a public asset bucket. Reassert the private
    // configuration if an older/manual bucket was created differently.
    if (data.public) {
      const { error: updateError } = await service.storage.updateBucket(
        OWNER_MUSIC_BUCKET,
        bucketOptions,
      );
      if (updateError) throw updateError;
    }
    return;
  }

  const missingBucket =
    error?.message?.toLowerCase().includes("not found") ||
    error?.message?.toLowerCase().includes("does not exist");

  if (error && !missingBucket) throw error;

  const { error: createError } = await service.storage.createBucket(
    OWNER_MUSIC_BUCKET,
    bucketOptions,
  );

  if (
    createError &&
    !createError.message.toLowerCase().includes("already exists")
  ) {
    throw createError;
  }
}
