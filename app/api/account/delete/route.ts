import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Account deletion is unavailable." },
      { status: 503, headers: noStoreHeaders() },
    );
  }

  const admin = createAdminClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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

  return NextResponse.json(
    { ok: true },
    { headers: noStoreHeaders() },
  );
}
