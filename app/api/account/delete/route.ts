import { NextRequest, NextResponse } from "next/server";
import { isProtectedSuperAdminAccount } from "@/lib/admin/access";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function removeProfileStorageObjects(userId: string) {
  const service = createServiceClient();
  const bucket = service.storage.from("profile-photos");
  const { data, error } = await bucket.list(userId, { limit: 1000 });

  if (error) {
    console.error("Self-service profile storage listing failed", {
      userId,
      message: error.message,
    });
    return { removed: 0, status: "failed" as const };
  }

  const paths = (data ?? []).map((object) => `${userId}/${object.name}`);
  if (!paths.length) {
    return { removed: 0, status: "not_found" as const };
  }

  const { error: removeError } = await bucket.remove(paths);
  if (removeError) {
    console.error("Self-service profile storage cleanup failed", {
      userId,
      message: removeError.message,
    });
    return { removed: 0, status: "failed" as const };
  }

  return { removed: paths.length, status: "complete" as const };
}


export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  if (await isProtectedSuperAdminAccount(user.id, user.email)) {
    return NextResponse.json(
      { error: "Protected super-admin accounts cannot be deleted." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  let admin: ReturnType<typeof createServiceClient>;
  try {
    admin = createServiceClient();
  } catch (error) {
    console.error("Account deletion client initialization failed", {
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "Account deletion is unavailable." },
      { status: 503, headers: noStoreHeaders() },
    );
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    console.error("Account deletion failed", {
      userId: user.id,
      code: error.code,
      status: error.status,
    });

    return NextResponse.json(
      { error: "The account could not be deleted." },
      { status: 500, headers: noStoreHeaders() },
    );
  }

  const storageCleanup = await removeProfileStorageObjects(user.id);

  return NextResponse.json(
    {
      ok: true,
      storageCleanup: storageCleanup.status,
      storageObjectsRemoved: storageCleanup.removed,
    },
    { headers: noStoreHeaders() },
  );
}
