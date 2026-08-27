import "server-only";

import {
  constants,
  createHash,
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
} from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import type { CustomerWrappedVaultKeyV1 } from "@/lib/e2ee/customerRecoveryKey";
import type { EmergencyRecoveryEnvelopeV1 } from "@/lib/e2ee/emergencyRecoveryEnvelope";

type RewrapInput = {
  userId: string;
  recoveryRequestId: string;
  recoveryAccessId: string;
  emergencyEnvelope: EmergencyRecoveryEnvelopeV1;
  customerAlgorithm: "RSA-OAEP-256";
  customerPublicJwk: JsonWebKey;
};

type InternalRecoveryKeyRow = {
  kid: string;
  algorithm: string;
  private_jwk: string;
};

function base64UrlToBuffer(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function customerRecoveryLabel(userId: string, recoveryAccessId: string): Buffer {
  return Buffer.from(
    `ficonter:customer-recovery:${userId}:${recoveryAccessId}:v1`,
    "utf8",
  );
}

async function loadInternalRecoveryKey(): Promise<InternalRecoveryKeyRow> {
  const service = createServiceClient() as any;
  const { data, error } = await service.rpc(
    "ficonter_get_active_recovery_private_key",
  );

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (
    !row ||
    typeof row.kid !== "string" ||
    row.algorithm !== "RSA-OAEP-256" ||
    typeof row.private_jwk !== "string" ||
    row.private_jwk.length < 64
  ) {
    throw new Error("FICONTER Assisted Recovery key is not configured.");
  }

  return row as InternalRecoveryKeyRow;
}

export function isManagedRecoveryBoundaryConfigured(): boolean {
  // The recovery boundary is internal to FICONTER. Runtime validation still
  // fails closed if the active Supabase Vault recovery key is unavailable.
  return true;
}

export async function rewrapVaultKeyForCustomer(
  input: RewrapInput,
): Promise<CustomerWrappedVaultKeyV1> {
  if (input.customerAlgorithm !== "RSA-OAEP-256") {
    throw new Error("Unsupported customer recovery algorithm.");
  }
  if (
    input.emergencyEnvelope.v !== 1 ||
    input.emergencyEnvelope.alg !== "RSA-OAEP-256" ||
    !input.emergencyEnvelope.kid ||
    !input.emergencyEnvelope.ct
  ) {
    throw new Error("Invalid emergency recovery envelope.");
  }
  if (
    input.customerPublicJwk.kty !== "RSA" ||
    !input.customerPublicJwk.n ||
    !input.customerPublicJwk.e ||
    input.customerPublicJwk.d
  ) {
    throw new Error("Invalid customer recovery public key.");
  }

  const internalKey = await loadInternalRecoveryKey();
  if (internalKey.kid !== input.emergencyEnvelope.kid) {
    throw new Error("Emergency recovery envelope uses an unavailable recovery key version.");
  }

  let privateJwk: JsonWebKey;
  try {
    privateJwk = JSON.parse(internalKey.private_jwk) as JsonWebKey;
  } catch {
    throw new Error("FICONTER Assisted Recovery key is invalid.");
  }

  if (
    privateJwk.kty !== "RSA" ||
    !privateJwk.n ||
    !privateJwk.e ||
    !privateJwk.d
  ) {
    throw new Error("FICONTER Assisted Recovery key is invalid.");
  }

  const encryptedPayload = base64UrlToBuffer(input.emergencyEnvelope.ct);
  let payload: Buffer | null = null;
  let rawVaultKey: Buffer | null = null;

  try {
    const recoveryPrivateKey = createPrivateKey({
      key: privateJwk as any,
      format: "jwk",
    });

    payload = privateDecrypt(
      {
        key: recoveryPrivateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      encryptedPayload,
    );

    if (payload.length !== 65 || payload[0] !== 1) {
      throw new Error("Recovered Vault payload is invalid.");
    }

    const expectedUserHash = createHash("sha256")
      .update(input.userId, "utf8")
      .digest();
    const actualUserHash = payload.subarray(1, 33);

    if (
      expectedUserHash.length !== actualUserHash.length ||
      !expectedUserHash.equals(actualUserHash)
    ) {
      throw new Error("Recovery envelope does not belong to this customer.");
    }

    rawVaultKey = Buffer.from(payload.subarray(33, 65));
    if (rawVaultKey.length !== 32) {
      throw new Error("Recovered Vault key is invalid.");
    }

    const customerPublicKey = createPublicKey({
      key: input.customerPublicJwk as any,
      format: "jwk",
    });

    const customerCiphertext = publicEncrypt(
      {
        key: customerPublicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
        oaepLabel: customerRecoveryLabel(input.userId, input.recoveryAccessId),
      },
      rawVaultKey,
    );

    return {
      v: 1,
      alg: "RSA-OAEP-256",
      ct: customerCiphertext.toString("base64url"),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Recovery ")) {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith("Recovered ")) {
      throw error;
    }
    throw new Error("FICONTER could not re-wrap the Vault key for this recovery session.");
  } finally {
    payload?.fill(0);
    rawVaultKey?.fill(0);
    encryptedPayload.fill(0);
    privateJwk = {};
  }
}
