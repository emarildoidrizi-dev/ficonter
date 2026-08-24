import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { submitCustomerRecoveryConsent } from "@/lib/admin/vaultRecoveryInbox";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { signature?: string };
    const result = await submitCustomerRecoveryConsent({
      recoveryRequestId: id,
      userId: user.id,
      signature: String(body.signature ?? ""),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Customer recovery consent submission failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The signed consent could not be submitted." },
      { status: 400 },
    );
  }
}
