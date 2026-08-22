"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createClient } from "@/lib/supabase/client";
import { useVault } from "@/components/VaultProvider";
import {
  createBusinessSharingKeyPair,
  createBusinessVaultKey,
  openBusinessSharingPrivateKey,
  unwrapBusinessVaultKey,
  wrapBusinessVaultKey,
  type BusinessWrappedKeyEnvelopeV1,
} from "@/lib/e2ee/businessVault";
import { installBusinessE2eeBoundary } from "@/lib/e2ee/businessClientBoundary";
import { finalizePendingBusinessRecurringCosts } from "@/lib/e2ee/businessRecurringCostFinalizer";
import type { VaultCiphertextEnvelopeV1 } from "@/lib/e2ee/vault";

type BusinessVaultStatus =
  | "idle"
  | "loading"
  | "locked"
  | "unlocked"
  | "unavailable"
  | "error";

type BusinessVaultContextValue = {
  status: BusinessVaultStatus;
  businessKey: CryptoKey | null;
  error: string | null;
  refresh: () => Promise<void>;
};

const BusinessVaultContext = createContext<BusinessVaultContextValue | null>(null);

async function ensureSharingKeyPair(
  client: any,
  personalVaultKey: CryptoKey,
  userId: string,
) {
  const { data, error } = await client
    .from("user_business_keypairs")
    .select("public_key_jwk,encrypted_private_key,encryption_version")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const created = await createBusinessSharingKeyPair(personalVaultKey, userId);
  const { data: inserted, error: insertError } = await client
    .from("user_business_keypairs")
    .insert({
      user_id: userId,
      public_key_jwk: created.publicKeyJwk,
      encrypted_private_key: created.encryptedPrivateKey,
      encryption_version: 1,
    })
    .select("public_key_jwk,encrypted_private_key,encryption_version")
    .single();
  if (insertError || !inserted) throw insertError ?? new Error("Business sharing key could not be stored.");
  return inserted;
}

export async function initializeBusinessVaultForOwner(
  client: any,
  personalVaultKey: CryptoKey,
  userId: string,
  businessId: string,
): Promise<CryptoKey> {
  const sharing = await ensureSharingKeyPair(client, personalVaultKey, userId);

  const { data: existingKey, error: existingKeyError } = await client
    .from("business_vault_member_keys")
    .select("wrapped_business_key,wrap_version")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingKeyError) throw existingKeyError;

  if (existingKey?.wrapped_business_key) {
    const privateKey = await openBusinessSharingPrivateKey(
      personalVaultKey,
      userId,
      sharing.encrypted_private_key as VaultCiphertextEnvelopeV1,
    );
    return unwrapBusinessVaultKey(
      privateKey,
      existingKey.wrapped_business_key as BusinessWrappedKeyEnvelopeV1,
    );
  }

  const { error: ensureError } = await client.rpc("ensure_business_vault_record", {
    p_business_id: businessId,
  });
  if (ensureError) throw ensureError;

  const { count, error: countError } = await client
    .from("business_vault_member_keys")
    .select("user_id", { count: "exact", head: true })
    .eq("business_id", businessId);
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new Error("This business vault already exists but has not been shared with this account.");
  }

  const businessKey = await createBusinessVaultKey();
  const wrapped = await wrapBusinessVaultKey(businessKey, sharing.public_key_jwk as JsonWebKey);
  const { error: insertError } = await client
    .from("business_vault_member_keys")
    .insert({
      business_id: businessId,
      user_id: userId,
      wrapped_business_key: wrapped,
      wrap_version: 1,
      granted_by: userId,
    });
  if (insertError) throw insertError;
  return businessKey;
}

export function BusinessVaultProvider({
  userId,
  businessId,
  canManage,
  canWrite,
  children,
}: {
  userId: string;
  businessId: string | null;
  canManage: boolean;
  canWrite: boolean;
  children: ReactNode;
}) {
  const client = useMemo(() => createClient(), []);
  const { status: personalStatus, vaultKey: personalVaultKey } = useVault();
  const [status, setStatus] = useState<BusinessVaultStatus>(businessId ? "loading" : "idle");
  const [businessKey, setBusinessKey] = useState<CryptoKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activateBusinessKey = useCallback(
    (opened: CryptoKey) => {
      if (!businessId) return;
      installBusinessE2eeBoundary(client, opened, businessId);
      setBusinessKey(opened);
      setStatus("unlocked");
      if (canWrite) {
        void finalizePendingBusinessRecurringCosts(client, opened, businessId).catch((caught) => {
          console.warn("Pending encrypted business recurring costs could not all be finalized", {
            message: caught instanceof Error ? caught.message : "Unknown error",
          });
        });
      }
    },
    [businessId, canWrite, client],
  );

  const refresh = useCallback(async () => {
    setError(null);
    if (!businessId) {
      setBusinessKey(null);
      setStatus("idle");
      return;
    }
    if (personalStatus !== "unlocked" || !personalVaultKey) {
      setBusinessKey(null);
      setStatus("locked");
      return;
    }

    setStatus("loading");
    try {
      const sharing = await ensureSharingKeyPair(client, personalVaultKey, userId);
      const { data: memberKey, error: memberKeyError } = await client
        .from("business_vault_member_keys")
        .select("wrapped_business_key,wrap_version")
        .eq("business_id", businessId)
        .eq("user_id", userId)
        .maybeSingle();
      if (memberKeyError) throw memberKeyError;

      if (!memberKey?.wrapped_business_key) {
        if (!canManage) {
          setBusinessKey(null);
          setStatus("unavailable");
          return;
        }
        const initialized = await initializeBusinessVaultForOwner(
          client,
          personalVaultKey,
          userId,
          businessId,
        );
        activateBusinessKey(initialized);
        return;
      }

      const privateKey = await openBusinessSharingPrivateKey(
        personalVaultKey,
        userId,
        sharing.encrypted_private_key as VaultCiphertextEnvelopeV1,
      );
      const opened = await unwrapBusinessVaultKey(
        privateKey,
        memberKey.wrapped_business_key as BusinessWrappedKeyEnvelopeV1,
      );
      activateBusinessKey(opened);
    } catch (caught) {
      setBusinessKey(null);
      setError(caught instanceof Error ? caught.message : "Business vault could not be opened.");
      setStatus("error");
    }
  }, [activateBusinessKey, businessId, canManage, client, personalStatus, personalVaultKey, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<BusinessVaultContextValue>(
    () => ({ status, businessKey, error, refresh }),
    [status, businessKey, error, refresh],
  );

  return <BusinessVaultContext.Provider value={value}>{children}</BusinessVaultContext.Provider>;
}

export function useBusinessVault() {
  const context = useContext(BusinessVaultContext);
  if (!context) throw new Error("useBusinessVault must be used inside BusinessVaultProvider.");
  return context;
}
