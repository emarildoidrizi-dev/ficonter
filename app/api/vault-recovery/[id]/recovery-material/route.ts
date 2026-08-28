import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { createServiceClient } from "@/lib/supabase/admin";
import { rewrapVaultKeyForCustomer } from "@/lib/vaultRecovery/managedRecoveryBoundary";
import type { EmergencyRecoveryEnvelopeV1 } from "@/lib/e2ee/emergencyRecoveryEnvelope";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const service = createServiceClient() as any;

    const { data: recoveryRequest, error: requestError } = await service
      .from("vault_recovery_requests")
      .select("id,user_id,status,archived_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (requestError) throw requestError;
    if (!recoveryRequest || recoveryRequest.archived_at) {
      return NextResponse.json({ error: "Recovery request is not active." }, { status: 404 });
    }

    const { data: grant, error: grantError } = await service
      .from("vault_recovery_access_grants")
      .select("id,status,expires_at,customer_key_algorithm,customer_ephemeral_public_key,key_bound_at,recovery_material_issued_at")
      .eq("recovery_request_id", id)
      .eq("user_id", user.id)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (grantError) throw grantError;
    if (!grant || grant.status !== "claimed") {
      return NextResponse.json({ error: "A claimed Recovery Access grant is required." }, { status: 409 });
    }
    if (new Date(grant.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Recovery Access has expired." }, { status: 410 });
    }
    if (grant.recovery_material_issued_at) {
      return NextResponse.json(
        { error: "Recovery material has already been issued for this Recovery Access. Generate a new Recovery Access to continue." },
        { status: 409 },
      );
    }
    if (
      grant.customer_key_algorithm !== "RSA-OAEP-256" ||
      !grant.customer_ephemeral_public_key ||
      !grant.key_bound_at
    ) {
      return NextResponse.json({ error: "A customer recovery key must be bound first." }, { status: 409 });
    }

    let customerPublicJwk: JsonWebKey;
    try {
      customerPublicJwk = JSON.parse(grant.customer_ephemeral_public_key) as JsonWebKey;
    } catch {
      throw new Error("Stored customer recovery public key is invalid.");
    }
    if (customerPublicJwk.kty !== "RSA" || !customerPublicJwk.n || !customerPublicJwk.e || customerPublicJwk.d) {
      throw new Error("Stored customer recovery public key is invalid.");
    }

    const { data: envelopeRow, error: envelopeError } = await service
      .from("vault_emergency_recovery_envelopes")
      .select("envelope_version,algorithm,kms_key_id,ciphertext")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (envelopeError) throw envelopeError;
    if (!envelopeRow) {
      return NextResponse.json(
        { error: "This Vault does not yet have Assisted Recovery protection." },
        { status: 409 },
      );
    }

    const issuedAt = new Date().toISOString();
    const { data: marked, error: markError } = await service
      .from("vault_recovery_access_grants")
      .update({ recovery_material_issued_at: issuedAt, updated_at: issuedAt })
      .eq("id", grant.id)
      .eq("status", "claimed")
      .is("recovery_material_issued_at", null)
      .select("id")
      .maybeSingle();

    if (markError) throw markError;
    if (!marked) {
      return NextResponse.json(
        { error: "Recovery material has already been issued for this Recovery Access. Generate a new Recovery Access to continue." },
        { status: 409 },
      );
    }

    const emergencyEnvelope: EmergencyRecoveryEnvelopeV1 = {
      v: envelopeRow.envelope_version,
      alg: envelopeRow.algorithm,
      kid: envelopeRow.kms_key_id,
      ct: envelopeRow.ciphertext,
    } as EmergencyRecoveryEnvelopeV1;

    let wrappedVaultKey;
    try {
      wrappedVaultKey = await rewrapVaultKeyForCustomer({
        userId: user.id,
        recoveryRequestId: id,
        recoveryAccessId: grant.id,
        emergencyEnvelope,
        customerAlgorithm: "RSA-OAEP-256",
        customerPublicJwk,
      });
    } catch (error) {
      await service
        .from("vault_recovery_access_grants")
        .update({
          status: "failed",
          failure_reason: "recovery_material_rewrap_failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", grant.id)
        .eq("status", "claimed");
      throw error;
    }

    await service.from("vault_recovery_case_audit").insert({
      recovery_request_id: id,
      action: "customer_recovery_material_issued",
      actor_id: user.id,
      details: {
        grant_id: grant.id,
        algorithm: "RSA-OAEP-256",
        issued_at: issuedAt,
      },
    });

    return NextResponse.json({
      ok: true,
      recoveryAccessId: grant.id,
      wrappedVaultKey,
    });
  } catch (error) {
    console.error("Customer Vault recovery material request failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recovery material could not be issued." },
      { status: 400 },
    );
  }
}
