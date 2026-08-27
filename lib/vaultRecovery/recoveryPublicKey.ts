import "server-only";

import type { EmergencyRecoveryPublicKeyV1 } from "@/lib/e2ee/emergencyRecoveryEnvelope";

export function getEmergencyRecoveryPublicKey(): EmergencyRecoveryPublicKeyV1 | null {
  const kid = process.env.FICONTER_RECOVERY_KMS_KEY_ID?.trim();
  const rawJwk = process.env.FICONTER_RECOVERY_KMS_PUBLIC_JWK?.trim();

  if (!kid || !rawJwk) return null;

  let jwk: JsonWebKey;
  try {
    jwk = JSON.parse(rawJwk) as JsonWebKey;
  } catch {
    throw new Error("FICONTER recovery public-key configuration is invalid.");
  }

  if (jwk.kty !== "RSA" || !jwk.n || !jwk.e || jwk.d) {
    throw new Error("FICONTER recovery public-key configuration is invalid.");
  }

  return {
    kid,
    alg: "RSA-OAEP-256",
    jwk,
  };
}
