import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import {
  issueVaultRecoveryAccess,
  revokeVaultRecoveryAccess,
} from "@/lib/admin/vaultRecoveryAccess";

export const dynamic = "force-dynamic";

function requireRecoveryAuthority(admin: { role: string } | null) {
  return admin?.role === "super_admin";
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requireRecoveryAuthority(admin)) {
    return NextResponse.json(
      { error: "Only the Owner or a Super Admin can issue Recovery Access." },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;
    const grant = await issueVaultRecoveryAccess({
      recoveryRequestId: id,
      actorId: user.id,
      ttlSeconds: 15 * 60,
    });
    return NextResponse.json({ ok: true, grant }, { status: 201 });
  } catch (error) {
    console.error("Vault Recovery Access issuance failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recovery Access could not be issued." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requireRecoveryAuthority(admin)) {
    return NextResponse.json(
      { error: "Only the Owner or a Super Admin can revoke Recovery Access." },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;
    const grant = await revokeVaultRecoveryAccess({
      recoveryRequestId: id,
      actorId: user.id,
    });
    return NextResponse.json({ ok: true, grant });
  } catch (error) {
    console.error("Vault Recovery Access revocation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recovery Access could not be revoked." },
      { status: 400 },
    );
  }
}
