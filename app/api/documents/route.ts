import { NextResponse } from "next/server";
import { MAX_USER_DOCUMENT_BYTES } from "@/lib/documentVault";
import { noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { subscriptionApiAccessError } from "@/lib/subscriptionApiAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  const subscriptionAccessError = await subscriptionApiAccessError("financial_documents");
  if (subscriptionAccessError) return subscriptionAccessError;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in again to view your documents." },
        { status: 401, headers: noStoreHeaders() },
      );
    }

    const { data, error } = await supabase
      .from("financial_documents")
      .select("id,user_id,size_bytes,encrypted_payload,encryption_version,file_encryption_version,e2ee_revision,created_at,updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const documents = data ?? [];
    const usedBytes = documents.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0);
    return NextResponse.json(
      { documents, usedBytes, limitBytes: MAX_USER_DOCUMENT_BYTES },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("Encrypted Document Vault list failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Your documents could not be loaded." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
