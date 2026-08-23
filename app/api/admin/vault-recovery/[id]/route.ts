import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { setVaultRecoveryCaseArchived, updateVaultRecoveryCase } from "@/lib/admin/vaultRecovery";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json() as {
      action?: "edit" | "archive" | "restore";
      customerEmail?: string;
      customerName?: string;
      countryRegion?: string;
      internalNotes?: string;
    };

    if (body.action === "archive" || body.action === "restore") {
      await setVaultRecoveryCaseArchived({ recoveryRequestId: id, actorId: user.id, archived: body.action === "archive" });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "edit") {
      await updateVaultRecoveryCase({
        recoveryRequestId: id,
        actorId: user.id,
        customerEmail: body.customerEmail,
        customerName: body.customerName,
        countryRegion: body.countryRegion,
        internalNotes: body.internalNotes,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid recovery case action." }, { status: 400 });
  } catch (error) {
    console.error("Vault recovery case update failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The recovery case could not be updated." }, { status: 500 });
  }
}
