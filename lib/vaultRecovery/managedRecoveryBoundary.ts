import "server-only";

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

function configuredBoundary() {
  const url = process.env.FICONTER_RECOVERY_BOUNDARY_URL?.trim();
  const token = process.env.FICONTER_RECOVERY_BOUNDARY_TOKEN?.trim();
  if (!url || !token) return null;

  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error("Managed recovery boundary must use HTTPS.");
  }

  return { url: parsed.toString(), token };
}

export function isManagedRecoveryBoundaryConfigured(): boolean {
  return Boolean(configuredBoundary());
}

export async function rewrapVaultKeyForCustomer(input: RewrapInput): Promise<CustomerWrappedVaultKeyV1> {
  const boundary = configuredBoundary();
  if (!boundary) {
    throw new Error("Managed Assisted Recovery boundary is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(boundary.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${boundary.token}`,
        "Idempotency-Key": input.recoveryAccessId,
      },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        operation: "rewrap-vault-key-v1",
        context: {
          userId: input.userId,
          recoveryRequestId: input.recoveryRequestId,
          recoveryAccessId: input.recoveryAccessId,
        },
        source: {
          envelope: input.emergencyEnvelope,
          label: `ficonter:assisted-recovery:${input.userId}:v1`,
        },
        destination: {
          alg: input.customerAlgorithm,
          publicJwk: input.customerPublicJwk,
          label: `ficonter:customer-recovery:${input.userId}:${input.recoveryAccessId}:v1`,
        },
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        typeof data?.error === "string" ? data.error : "Managed recovery boundary rejected the request.",
      );
    }

    const wrapped = data?.wrappedVaultKey as CustomerWrappedVaultKeyV1 | undefined;
    if (!wrapped || wrapped.v !== 1 || wrapped.alg !== "RSA-OAEP-256" || typeof wrapped.ct !== "string" || wrapped.ct.length < 32) {
      throw new Error("Managed recovery boundary returned invalid recovery material.");
    }

    return wrapped;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Managed recovery boundary timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
