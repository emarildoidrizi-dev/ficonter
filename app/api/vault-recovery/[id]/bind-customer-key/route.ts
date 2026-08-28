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
    const algorithm = typeof body?.algorithm === "string" ? body.algorithm : "";
    const publicJwk = body?.publicJwk;

    if (algorithm !== "RSA-OAEP-256") {
      return NextResponse.json({ error: "Unsupported customer recovery key algorithm." }, { status: 400 });
    }

    if (!publicJwk || typeof publicJwk !== "object" || publicJwk.kty !== "RSA" || !publicJwk.n || !publicJwk.e || publicJwk.d) {
      return NextResponse.json({ error: "Invalid customer recovery public key." }, { status: 400 });
    }

    const publicKey = JSON.stringify(publicJwk);
    const service = createServiceClient() as any;
    const { data, error } = await service.rpc("customer_bind_vault_recovery_key", {
      p_recovery_request_id: id,
      p_user_id: user.id,
      p_algorithm: algorithm,
      p_public_key: publicKey,
    });

    if (error) throw error;
    const binding = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({ ok: true, binding });
  } catch (error) {
    console.error("Customer Vault recovery key binding failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Customer recovery key could not be bound." },
      { status: 400 },
    );
  }
}
