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

import {
  createNewVault,
  unlockVaultWithRecovery,
  type WrappedVaultKeyEnvelopeV1,
} from "@/lib/e2ee/vault";

type VaultStatus =
  | "loading"
  | "not_created"
  | "locked"
  | "unlocked"
  | "error";

type VaultContextValue = {
  status: VaultStatus;
  vaultKey: CryptoKey | null;
  recoveryCode: string | null;
  error: string | null;

  createVault: () => Promise<string>;
  unlockVault: (recoveryCode: string) => Promise<void>;
  lockVault: () => void;
  refreshVaultStatus: () => Promise<void>;
};

const VaultContext =
  createContext<VaultContextValue | null>(null);

type Props = {
  children: ReactNode;
};

export function VaultProvider({ children }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [status, setStatus] =
    useState<VaultStatus>("loading");

  const [vaultKey, setVaultKey] =
    useState<CryptoKey | null>(null);

  const [recoveryCode, setRecoveryCode] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const refreshVaultStatus =
    useCallback(async () => {
      setError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setVaultKey(null);
          setRecoveryCode(null);
          setStatus("locked");
          return;
        }

        const {
          data,
          error: vaultError,
        } = await supabase
          .from("user_financial_vaults")
          .select(
            "id, user_id, vault_status, key_version",
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (vaultError) {
          throw vaultError;
        }

        if (!data) {
          setVaultKey(null);
          setRecoveryCode(null);
          setStatus("not_created");
          return;
        }

        if (vaultKey) {
          setStatus("unlocked");
        } else {
          setStatus("locked");
        }
      } catch (caughtError) {
        setVaultKey(null);
        setRecoveryCode(null);

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to check vault status.",
        );

        setStatus("error");
      }
    }, [supabase, vaultKey]);

  const createVault =
    useCallback(async (): Promise<string> => {
      setError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error(
            "Please log in again before creating your vault.",
          );
        }

        const {
          data: existingVault,
          error: existingVaultError,
        } = await supabase
          .from("user_financial_vaults")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingVaultError) {
          throw existingVaultError;
        }

        if (existingVault) {
          throw new Error(
            "A financial vault already exists for this account.",
          );
        }

        const newVault =
          await createNewVault(user.id);

        const {
          error: insertError,
        } = await supabase
          .from("user_financial_vaults")
          .insert({
            user_id: user.id,
            wrapped_vault_key:
              newVault.wrappedVaultKey,
            key_version: 1,
            recovery_version: 1,
            vault_status: "active",
          });

        if (insertError) {
          throw insertError;
        }

        setVaultKey(newVault.vaultKey);
        setRecoveryCode(
          newVault.recoveryCode,
        );
        setStatus("unlocked");

        return newVault.recoveryCode;
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to create financial vault.";

        setError(message);
        throw caughtError;
      }
    }, [supabase]);

  const unlockVault =
    useCallback(
      async (enteredRecoveryCode: string) => {
        setError(null);

        try {
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError || !user) {
            throw new Error(
              "Please log in again before unlocking your vault.",
            );
          }

          const {
            data: vaultRecord,
            error: vaultError,
          } = await supabase
            .from("user_financial_vaults")
            .select(
              "wrapped_vault_key, vault_status",
            )
            .eq("user_id", user.id)
            .single();

          if (vaultError || !vaultRecord) {
            throw new Error(
              "Financial vault could not be found.",
            );
          }

          const unlockedKey =
            await unlockVaultWithRecovery(
              user.id,
              enteredRecoveryCode.trim(),
              vaultRecord.wrapped_vault_key as WrappedVaultKeyEnvelopeV1,
            );

          setVaultKey(unlockedKey);
          setRecoveryCode(null);
          setStatus("unlocked");

          await supabase
            .from("user_financial_vaults")
            .update({
              vault_status: "active",
              last_unlocked_at:
                new Date().toISOString(),
            })
            .eq("user_id", user.id);
        } catch (caughtError) {
          setVaultKey(null);
          setRecoveryCode(null);
          setStatus("locked");

          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to unlock financial vault.";

          setError(message);
          throw caughtError;
        }
      },
      [supabase],
    );

  const lockVault =
    useCallback(() => {
      setVaultKey(null);
      setRecoveryCode(null);
      setError(null);
      setStatus("locked");
    }, []);

  useEffect(() => {
    void refreshVaultStatus();

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      (event) => {
        if (
          event === "SIGNED_OUT"
        ) {
          setVaultKey(null);
          setRecoveryCode(null);
          setStatus("locked");
          return;
        }

        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED"
        ) {
          void refreshVaultStatus();
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refreshVaultStatus, supabase]);

  const value =
    useMemo<VaultContextValue>(
      () => ({
        status,
        vaultKey,
        recoveryCode,
        error,
        createVault,
        unlockVault,
        lockVault,
        refreshVaultStatus,
      }),
      [
        status,
        vaultKey,
        recoveryCode,
        error,
        createVault,
        unlockVault,
        lockVault,
        refreshVaultStatus,
      ],
    );

  return (
    <VaultContext.Provider value={value}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext);

  if (!context) {
    throw new Error(
      "useVault must be used inside VaultProvider.",
    );
  }

  return context;
}