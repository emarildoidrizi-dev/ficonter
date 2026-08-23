import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { createSignedVaultRecoveryConsentUrl, uploadSignedVaultRecoveryConsent } from "@/lib/admin/vaultRecovery";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Signed consent file is required." }, { status: 400 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadSignedVaultRecoveryConsent({
      recoveryRequestId: id,
      uploadedBy: user.id,
      fileName: file.name,
      mimeType: file.type,
      bytes,
    });

    return NextResponse.json({ ok: true, documentId: result.documentId });
  } catch (error) {
    console.error("Vault recovery signed consent upload failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The signed consent document could not be uploaded." }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const signedUrl = await createSignedVaultRecoveryConsentUrl(id);
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("Vault recovery signed consent open failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The signed consent document could not be opened." }, { status: 404 });
  }
}
