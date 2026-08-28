import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";

export type CustomerRecoveryAccessState = {
  id: string;
  status: string;
  effectiveStatus: string;
  issuedAt: string;
  expiresAt: string;
  claimedAt: string | null;
};

export type CustomerRecoveryAccessCase = {
  requestId: string;
  reference: string;
  requestStatus: string;
  archivedAt: string | null;
  access: CustomerRecoveryAccessState | null;
};

function normalizeGrant(row: any): CustomerRecoveryAccessState {
  const expiredByClock =
    ["issued", "claimed"].includes(row.status) &&
    new Date(row.expires_at).getTime() <= Date.now();

  return {
    id: row.id,
    status: row.status,
    effectiveStatus: expiredByClock ? "expired" : row.status,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    claimedAt: row.claimed_at ?? null,
  };
}

export async function getCustomerVaultRecoveryAccess(input: {
  recoveryRequestId: string;
  userId: string;
}): Promise<CustomerRecoveryAccessCase | null> {
  const service = createServiceClient() as any;
  const { data: request, error: requestError } = await service
    .from("vault_recovery_requests")
    .select("id,reference,user_id,status,archived_at")
    .eq("id", input.recoveryRequestId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (requestError) throw requestError;
  if (!request) return null;

  const { data: grant, error: grantError } = await service
    .from("vault_recovery_access_grants")
    .select("id,status,issued_at,expires_at,claimed_at")
    .eq("recovery_request_id", request.id)
    .eq("user_id", input.userId)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (grantError) throw grantError;

  return {
    requestId: request.id,
    reference: request.reference,
    requestStatus: request.status,
    archivedAt: request.archived_at ?? null,
    access: grant ? normalizeGrant(grant) : null,
  };
}

export async function listCustomerVaultRecoveryAccesses(
  userId: string,
): Promise<CustomerRecoveryAccessCase[]> {
  const service = createServiceClient() as any;
  const { data: requests, error: requestError } = await service
    .from("vault_recovery_requests")
    .select("id,reference,user_id,status,archived_at")
    .eq("user_id", userId)
    .is("archived_at", null)
    .eq("status", "recovery_issued")
    .order("created_at", { ascending: false });

  if (requestError) throw requestError;
  if (!requests?.length) return [];

  const requestIds = requests.map((item: any) => item.id);
  const { data: grants, error: grantError } = await service
    .from("vault_recovery_access_grants")
    .select("id,recovery_request_id,status,issued_at,expires_at,claimed_at")
    .eq("user_id", userId)
    .in("recovery_request_id", requestIds)
    .order("issued_at", { ascending: false });

  if (grantError) throw grantError;

  const latestByRequest = new Map<string, CustomerRecoveryAccessState>();
  for (const row of grants ?? []) {
    if (!latestByRequest.has(row.recovery_request_id)) {
      latestByRequest.set(row.recovery_request_id, normalizeGrant(row));
    }
  }

  return requests
    .map((request: any) => ({
      requestId: request.id,
      reference: request.reference,
      requestStatus: request.status,
      archivedAt: request.archived_at ?? null,
      access: latestByRequest.get(request.id) ?? null,
    }))
    .filter((item: CustomerRecoveryAccessCase) => Boolean(item.access));
}

export async function claimCustomerVaultRecoveryAccess(input: {
  recoveryRequestId: string;
  userId: string;
}): Promise<CustomerRecoveryAccessState> {
  const service = createServiceClient() as any;
  const { data, error } = await service.rpc("customer_claim_vault_recovery_access", {
    p_recovery_request_id: input.recoveryRequestId,
    p_user_id: input.userId,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Recovery Access could not be claimed.");

  return normalizeGrant(row);
}
