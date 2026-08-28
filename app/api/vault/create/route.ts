import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const wrappedVaultKey = body?.wrappedVaultKey;
    const emergencyEnvelope = body?.emergencyEnvelope;

    if (!wrappedVaultKey || typeof wrappedVaultKey !== "object") {
      return NextResponse.json({ error: "Wrapped Vault key is required." }, { status: 400 });
    }
    if (!emergencyEnvelope || typeof emergencyEnvelope !== "object") {
      return NextResponse.json({ error: "Emergency recovery envelope is required." }, { status: 400 });
    }

    const service = createServiceClient() as any;
    const { data, error } = await service.rpc("customer_create_financial_vault_with_recovery", {
      p_user_id: user.id,
      p_wrapped_vault_key: wrappedVaultKey,
      p_emergency_envelope: emergencyEnvelope,
    });

    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Protected Financial Vault creation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Financial Vault could not be created." },
      { status: 400 },
    );
  }
}
