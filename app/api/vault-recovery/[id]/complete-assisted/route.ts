import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const expectedRecoveryVersion = Number(body?.expectedRecoveryVersion);
    const wrappedVaultKey = body?.wrappedVaultKey;

    if (!Number.isInteger(expectedRecoveryVersion) || expectedRecoveryVersion < 1) {
      return NextResponse.json({ error: "Invalid recovery version." }, { status: 400 });
    }
    if (!wrappedVaultKey || typeof wrappedVaultKey !== "object") {
      return NextResponse.json({ error: "Wrapped Vault key is required." }, { status: 400 });
    }

    const service = createServiceClient() as any;
    const { data, error } = await service.rpc("customer_complete_vault_assisted_recovery", {
      p_recovery_request_id: id,
      p_user_id: user.id,
      p_expected_recovery_version: expectedRecoveryVersion,
      p_wrapped_vault_key: wrappedVaultKey,
    });

    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Vault Assisted Recovery completion failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vault Assisted Recovery could not be completed." },
      { status: 400 },
    );
  }
}
