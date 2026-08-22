import { NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { subscriptionApiAccessError } from "@/lib/subscriptionApiAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, _context: RouteContext) {
  const subscriptionAccessError = await subscriptionApiAccessError("financial_documents");
  if (subscriptionAccessError) return subscriptionAccessError;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in again before extracting financial data." },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  return NextResponse.json(
    {
      error: "Document extraction runs only inside your unlocked Financial Vault. The server cannot read encrypted document contents.",
    },
    { status: 410, headers: noStoreHeaders() },
  );
}
