import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { deleteVaultRecoveryCase, setVaultRecoveryCaseArchived, setVaultRecoveryCaseStatus, updateVaultRecoveryCase } from "@/lib/admin/vaultRecovery";
import { revokeActiveVaultRecoveryAccess } from "@/lib/admin/vaultRecoveryAccess";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json() as {
      action?: "edit" | "archive" | "restore" | "start_verification" | "mark_consent_signed" | "approve" | "reject" | "cancel";
      customerEmail?: string;
      customerName?: string;
      countryRegion?: string;
      internalNotes?: string;
    };

    if (body.action === "archive" || body.action === "restore") {
      if (body.action === "archive") {
        await revokeActiveVaultRecoveryAccess({ recoveryRequestId: id, actorId: user.id });
      }
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

    if (body.action === "cancel") {
      await revokeActiveVaultRecoveryAccess({ recoveryRequestId: id, actorId: user.id });
    }

    const statusByAction = {
      start_verification: "verification_pending",
      mark_consent_signed: "consent_signed",
      approve: "approved",
      reject: "rejected",
      cancel: "cancelled",
    } as const;

    if (body.action && body.action in statusByAction) {
      await setVaultRecoveryCaseStatus({
        recoveryRequestId: id,
        actorId: user.id,
        status: statusByAction[body.action as keyof typeof statusByAction],
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid recovery case action." }, { status: 400 });
  } catch (error) {
    console.error("Vault recovery case update failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The recovery case could not be updated." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    await deleteVaultRecoveryCase({ recoveryRequestId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Vault recovery case deletion failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The recovery case could not be deleted." }, { status: 500 });
  }
}
