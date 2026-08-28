import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { generateVaultRecoveryConsentDocument } from "@/lib/admin/vaultRecovery";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const document = await generateVaultRecoveryConsentDocument({ recoveryRequestId: id, generatedBy: user.id });
    return NextResponse.json({ document, documentUrl: `/dashboard/admin/support/vault-recovery/${id}/consent` }, { status: 201 });
  } catch (error) {
    console.error("Vault recovery consent generation failed", error);
    return NextResponse.json({ error: "The consent document could not be generated." }, { status: 500 });
  }
}
