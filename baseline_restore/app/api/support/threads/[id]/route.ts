import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "This request could not be verified." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in again before deleting this conversation." },
        { status: 401, headers: noStoreHeaders() },
      );
    }

    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json(
        { error: "Choose a valid support conversation." },
        { status: 400, headers: noStoreHeaders() },
      );
    }

    const { data: ownedThread, error: ownershipError } = await supabase
      .from("support_requests")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownershipError) throw ownershipError;
    if (!ownedThread) {
      return NextResponse.json(
        { error: "This support conversation was not found." },
        { status: 404, headers: noStoreHeaders() },
      );
    }

    const service = createServiceClient();
    const { data: deleted, error: deleteError } = await service
      .from("support_requests")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (deleteError) throw deleteError;
    if (!deleted) {
      return NextResponse.json(
        { error: "This support conversation was already removed." },
        { status: 404, headers: noStoreHeaders() },
      );
    }

    return NextResponse.json({ ok: true, deletedId: deleted.id }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("Customer support conversation deletion failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "The conversation could not be deleted. Please try again." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
