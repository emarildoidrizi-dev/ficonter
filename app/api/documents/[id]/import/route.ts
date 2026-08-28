import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { subscriptionApiAccessError } from "@/lib/subscriptionApiAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: noStoreHeaders() });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const subscriptionAccessError = await subscriptionApiAccessError("financial_documents");
  if (subscriptionAccessError) return subscriptionAccessError;
  if (!isSameOriginRequest(request)) {
    return errorResponse("This request could not be verified.", 403);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return errorResponse("Sign in again before importing financial data.", 401);
  }

  await context.params;

  return errorResponse(
    "Financial document imports run only inside the unlocked Financial Vault.",
    410,
  );
}
