import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { getEmergencyRecoveryPublicKey } from "@/lib/vaultRecovery/recoveryPublicKey";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const recoveryPublicKey = await getEmergencyRecoveryPublicKey();
    if (!recoveryPublicKey) {
      return NextResponse.json(
        { error: "Assisted Recovery protection is not configured." },
        { status: 503 },
      );
    }

    return NextResponse.json({ recoveryPublicKey });
  } catch (error) {
    console.error("Vault recovery public key read failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recovery public key could not be loaded." },
      { status: 500 },
    );
  }
}
