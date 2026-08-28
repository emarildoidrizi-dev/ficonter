import { NextRequest, NextResponse } from "next/server";
import { subscriptionApiAccessError } from "@/lib/subscriptionApiAccess";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const subscriptionAccessError = await subscriptionApiAccessError("financial_documents");
  if (subscriptionAccessError) return subscriptionAccessError;
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "This request could not be verified." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in again before importing a financial file." },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  return NextResponse.json(
    {
      error: "Server-side PDF extraction is disabled by FICONTER zero-knowledge protection. Financial documents must be decrypted and analysed inside the unlocked browser vault.",
    },
    { status: 410, headers: noStoreHeaders() },
  );
}
