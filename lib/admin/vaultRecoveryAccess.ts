import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";

export type VaultRecoveryAccessState = {
  id: string;
  status: string;
  effectiveStatus: string;
  issuedAt: string;
  expiresAt: string;
  claimedAt: string | null;
  completedAt: string | null;
  revokedAt: string | null;
};

function normalizeGrant(row: any): VaultRecoveryAccessState {
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
    completedAt: row.completed_at ?? null,
    revokedAt: row.revoked_at ?? null,
  };
}

export async function attachRecoveryAccessState(cases: any[]) {
  const service = createServiceClient() as any;
  const requestIds = cases.map((item: any) => item.id).filter(Boolean);
  if (!requestIds.length) return cases;

  const { data, error } = await service
    .from("vault_recovery_access_grants")
    .select("id,recovery_request_id,status,issued_at,expires_at,claimed_at,completed_at,revoked_at")
    .in("recovery_request_id", requestIds)
    .order("issued_at", { ascending: false });
  if (error) throw error;

  const latestByRequest = new Map<string, VaultRecoveryAccessState>();
  for (const row of data ?? []) {
    if (latestByRequest.has(row.recovery_request_id)) continue;
    latestByRequest.set(row.recovery_request_id, normalizeGrant(row));
  }

  return cases.map((item: any) => ({
    ...item,
    recoveryAccess: latestByRequest.get(item.id) ?? null,
  }));
}

export async function issueVaultRecoveryAccess(input: {
  recoveryRequestId: string;
  actorId: string;
  ttlSeconds?: number;
}) {
  const service = createServiceClient() as any;
  const { data, error } = await service.rpc("admin_issue_vault_recovery_access", {
    p_recovery_request_id: input.recoveryRequestId,
    p_actor_id: input.actorId,
    p_ttl_seconds: input.ttlSeconds ?? 900,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Recovery access could not be issued.");

  return {
    id: row.id,
    recoveryRequestId: row.recovery_request_id,
    userId: row.user_id,
    status: row.status,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
  };
}

export async function revokeVaultRecoveryAccess(input: {
  recoveryRequestId: string;
  actorId: string;
}) {
  const service = createServiceClient() as any;
  const { data, error } = await service.rpc("admin_revoke_vault_recovery_access", {
    p_recovery_request_id: input.recoveryRequestId,
    p_actor_id: input.actorId,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Recovery access could not be revoked.");

  return {
    id: row.id,
    status: row.status,
    revokedAt: row.revoked_at,
  };
}

export async function revokeActiveVaultRecoveryAccess(input: {
  recoveryRequestId: string;
  actorId: string;
}) {
  const service = createServiceClient() as any;
  const { data, error } = await service
    .from("vault_recovery_access_grants")
    .select("id")
    .eq("recovery_request_id", input.recoveryRequestId)
    .in("status", ["issued", "claimed"])
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return revokeVaultRecoveryAccess(input);
}
