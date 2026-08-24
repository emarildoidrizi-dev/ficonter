import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import {
  createVaultRecoveryCase,
  generateVaultRecoveryConsentDocument,
  getRecoveryCustomer,
  listRecoveryCustomers,
  listVaultRecoveryCases,
  setVaultRecoveryCaseStatus,
} from "@/lib/admin/vaultRecovery";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [customers, cases] = await Promise.all([listRecoveryCustomers(), listVaultRecoveryCases()]);
    return NextResponse.json({ customers, cases });
  } catch (error) {
    console.error("Vault recovery admin list failed", error);
    return NextResponse.json({ error: "Vault recovery cases could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as { userId?: string };
    if (!body.userId) return NextResponse.json({ error: "Choose a customer first." }, { status: 400 });

    const customer = await getRecoveryCustomer(body.userId);
    const created = await createVaultRecoveryCase({
      userId: customer.id,
      customerEmail: customer.email,
      customerName: customer.name,
      createdBy: user.id,
    });

    await setVaultRecoveryCaseStatus({
      recoveryRequestId: created.id,
      actorId: user.id,
      status: "verification_pending",
    });

    const document = await generateVaultRecoveryConsentDocument({
      recoveryRequestId: created.id,
      generatedBy: user.id,
    });

    return NextResponse.json(
      {
        case: created,
        document,
        documentUrl: `/dashboard/admin/support/vault-recovery/${created.id}/consent`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Vault recovery document generation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The recovery document could not be generated." },
      { status: 500 },
    );
  }
}
