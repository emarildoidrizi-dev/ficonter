import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { createVaultRecoveryCase, listRecoveryCustomers, listVaultRecoveryCases } from "@/lib/admin/vaultRecovery";

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
    const body = await request.json() as { userId?: string; customerEmail?: string };
    if (!body.userId || !body.customerEmail) return NextResponse.json({ error: "Customer is required." }, { status: 400 });
    const created = await createVaultRecoveryCase({ userId: body.userId, customerEmail: body.customerEmail, createdBy: user.id });
    return NextResponse.json({ case: created }, { status: 201 });
  } catch (error) {
    console.error("Vault recovery case creation failed", error);
    return NextResponse.json({ error: "The recovery case could not be created." }, { status: 500 });
  }
}
