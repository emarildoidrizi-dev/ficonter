import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";
import type { EmergencyRecoveryPublicKeyV1 } from "@/lib/e2ee/emergencyRecoveryEnvelope";

type RecoveryKeyRegistryRow = {
  kid: string;
  algorithm: string;
  public_jwk: JsonWebKey;
};

export async function getEmergencyRecoveryPublicKey(): Promise<EmergencyRecoveryPublicKeyV1 | null> {
  const service = createServiceClient() as any;
  const { data, error } = await service
    .from("ficonter_recovery_key_registry")
    .select("kid,algorithm,public_jwk")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as RecoveryKeyRegistryRow;
  const jwk = row.public_jwk;

  if (
    row.algorithm !== "RSA-OAEP-256" ||
    !jwk ||
    jwk.kty !== "RSA" ||
    !jwk.n ||
    !jwk.e ||
    jwk.d
  ) {
    throw new Error("FICONTER recovery public-key configuration is invalid.");
  }

  return {
    kid: row.kid,
    alg: "RSA-OAEP-256",
    jwk,
  };
}
