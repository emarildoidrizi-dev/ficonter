import { NextResponse } from "next/server";
import { MAX_USER_DOCUMENT_BYTES } from "@/lib/documentVault";
import { noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DocumentRow = {
  id: string;
  original_name: string;
  display_name: string;
  category: string;
  mime_type: string;
  size_bytes: number;
  document_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapDocument(row: DocumentRow) {
  return {
    id: row.id,
    originalName: row.original_name,
    displayName: row.display_name,
    category: row.category,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    documentDate: row.document_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in again to view your documents." }, { status: 401, headers: noStoreHeaders() });
    const { data, error } = await supabase
      .from("financial_documents")
      .select("id,original_name,display_name,category,mime_type,size_bytes,document_date,notes,created_at,updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const documents = ((data ?? []) as DocumentRow[]).map(mapDocument);
    return NextResponse.json({ documents, usedBytes: documents.reduce((sum, item) => sum + item.sizeBytes, 0), limitBytes: MAX_USER_DOCUMENT_BYTES }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("Document Vault list failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "Your documents could not be loaded." }, { status: 500, headers: noStoreHeaders() });
  }
}
