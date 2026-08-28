import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  claimCustomerVaultRecoveryAccess,
  getCustomerVaultRecoveryAccess,
} from "@/lib/vaultRecovery/customerAccess";
import { getEmergencyRecoveryPublicKey } from "@/lib/vaultRecovery/recoveryPublicKey";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const recovery = await getCustomerVaultRecoveryAccess({
      recoveryRequestId: id,
      userId: user.id,
    });
    if (!recovery) return NextResponse.json({ error: "Recovery request not found." }, { status: 404 });

    const recoveryPublicKey = await getEmergencyRecoveryPublicKey();

    return NextResponse.json({
      recovery,
      recoveryPublicKey,
    });
  } catch (error) {
    console.error("Customer Recovery Access read failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recovery Access could not be loaded." },
      { status: 400 },
    );
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const access = await claimCustomerVaultRecoveryAccess({
      recoveryRequestId: id,
      userId: user.id,
    });

    if (access.effectiveStatus === "expired") {
      return NextResponse.json(
        { error: "This Recovery Access has expired. A new authorization must be issued.", access },
        { status: 410 },
      );
    }

    const recoveryPublicKey = await getEmergencyRecoveryPublicKey();

    return NextResponse.json({
      ok: true,
      access,
      recoveryPublicKey,
    });
  } catch (error) {
    console.error("Customer Recovery Access claim failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recovery Access could not be claimed." },
      { status: 400 },
    );
  }
}
