import { NextResponse } from "next/server";
import { loadCustomerSupportThreads } from "@/lib/supportData";
import { noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in again to view your inbox." }, { status: 401, headers: noStoreHeaders() });
    }
    const threads = await loadCustomerSupportThreads();
    return NextResponse.json({ threads }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("Customer support inbox refresh failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Your support inbox could not be refreshed." }, { status: 500, headers: noStoreHeaders() });
  }
}
