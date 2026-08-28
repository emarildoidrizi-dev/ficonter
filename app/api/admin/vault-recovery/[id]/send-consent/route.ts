import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { sendRecoveryConsentToCustomer } from "@/lib/admin/vaultRecoveryInbox";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const result = await sendRecoveryConsentToCustomer({
      recoveryRequestId: id,
      actorId: user.id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Vault recovery consent delivery failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The consent document could not be sent.",
      },
      { status: 400 },
    );
  }
}
