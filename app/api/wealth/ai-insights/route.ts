import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { subscriptionApiAccessError } from "@/lib/subscriptionApiAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: noStoreHeaders() },
  );
}

export async function POST(request: NextRequest) {
  const subscriptionAccessError = await subscriptionApiAccessError("smart_insights");
  if (subscriptionAccessError) return subscriptionAccessError;
  if (!isSameOriginRequest(request)) {
    return jsonError("Invalid request origin.", 403);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return jsonError("Not authenticated.", 401);

  return jsonError(
    "Smart Insights generation runs only inside the unlocked Financial Vault.",
    410,
  );
}

export async function DELETE(request: NextRequest) {
  const subscriptionAccessError = await subscriptionApiAccessError("smart_insights");
  if (subscriptionAccessError) return subscriptionAccessError;
  if (!isSameOriginRequest(request)) {
    return jsonError("Invalid request origin.", 403);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return jsonError("Not authenticated.", 401);

  const { error } = await supabase
    .from("ai_insight_snapshots")
    .delete()
    .eq("user_id", user.id);

  if (error) return jsonError("Smart Insight history could not be cleared.", 500);

  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
