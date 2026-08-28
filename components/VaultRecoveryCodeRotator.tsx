"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";

import { useVault } from "@/components/VaultProvider";
import { createClient } from "@/lib/supabase/client";
import {
  rotateRecoveryCodeForSameVaultKey,
} from "@/lib/e2ee/recoveryCodeRotation";
import type { WrappedVaultKeyEnvelopeV1 } from "@/lib/e2ee/vault";
import type { EmergencyRecoveryPublicKeyV1 } from "@/lib/e2ee/emergencyRecoveryEnvelope";
import { setActiveVaultKey } from "@/lib/e2ee/sessionKey";
import { rememberVaultKeyForBrowserSession } from "@/lib/e2ee/browserVaultSession";

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message?: string } | null }>;
};

export function VaultRecoveryCodeRotator() {
  const { status } = useVault();
  const [currentCode, setCurrentCode] = useState("");
  const [replacementCode, setReplacementCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  if (status !== "unlocked") return null;

  async function rotate() {
    if (busy || !currentCode.trim()) return;

    setBusy(true);
    setError("");
    setReplacementCode("");
    setCopied(false);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please log in again before rotating your recovery code.");
      }

      const { data: vaultRecord, error: vaultError } = await supabase
        .from("user_financial_vaults")
        .select("wrapped_vault_key,recovery_version")
        .eq("user_id", user.id)
        .single();

      if (vaultError || !vaultRecord) {
        throw new Error("Financial Vault could not be found.");
      }

      const publicKeyResponse = await fetch("/api/vault/recovery-public-key", {
        method: "GET",
        cache: "no-store",
      });
      const publicKeyData = await publicKeyResponse.json();
      if (!publicKeyResponse.ok || !publicKeyData.recoveryPublicKey) {
        throw new Error(
          publicKeyData.error ??
            "Assisted Recovery protection is not configured. No Vault changes were made.",
        );
      }

      const expectedRecoveryVersion = Math.max(
        1,
        Number(vaultRecord.recovery_version ?? 1),
      );

      const rotated = await rotateRecoveryCodeForSameVaultKey({
        userId: user.id,
        currentRecoveryCode: currentCode.trim(),
        envelope: vaultRecord.wrapped_vault_key as WrappedVaultKeyEnvelopeV1,
        emergencyRecoveryPublicKey:
          publicKeyData.recoveryPublicKey as EmergencyRecoveryPublicKeyV1,
      });

      if (!rotated.emergencyRecoveryEnvelope) {
        throw new Error("Emergency recovery protection could not be created.");
      }

      const { error: rotationError } = await (
        supabase as unknown as RpcClient
      ).rpc("customer_rotate_financial_vault_recovery", {
        p_expected_recovery_version: expectedRecoveryVersion,
        p_wrapped_vault_key: rotated.wrappedVaultKey,
        p_emergency_envelope: rotated.emergencyRecoveryEnvelope,
      });

      if (rotationError) {
        throw new Error(
          rotationError.message ?? "Recovery code could not be rotated.",
        );
      }

      setActiveVaultKey(rotated.vaultKey);
      await rememberVaultKeyForBrowserSession(user.id, rotated.vaultKey);

      setCurrentCode("");
      setReplacementCode(rotated.recoveryCode);
      window.dispatchEvent(new CustomEvent("ficonter:vault-recovery-rotated"));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Recovery code could not be rotated.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyReplacement() {
    if (!replacementCode) return;
    try {
      await navigator.clipboard.writeText(replacementCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Automatic copy was blocked. Select the new recovery code and copy it manually.");
    }
  }

  if (replacementCode) {
    return (
      <section className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">Recovery code replaced</h3>
            <p className="mt-1 text-sm opacity-70">
              The old recovery code is now invalid. Save this new code somewhere private before leaving this page.
            </p>
            <div className="mt-4 break-all rounded-lg border border-white/10 bg-black/20 p-3 font-mono text-sm">
              {replacementCode}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyReplacement}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm transition hover:bg-white/10"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy new code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplacementCode("");
                  setCopied(false);
                }}
                className="rounded-xl border border-white/15 px-3 py-2 text-sm transition hover:bg-white/10"
              >
                I saved the new code
              </button>
            </div>
            <p className="mt-3 text-xs opacity-60">
              Do not send this code in chat, email, screenshots, or support requests.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Replace recovery code</h3>
          <p className="mt-1 text-sm opacity-70">
            Enter your current recovery code. A new code will be generated only in this browser while the same encrypted Vault key and financial data are preserved.
          </p>
          <input
            type="password"
            value={currentCode}
            onChange={(event) => setCurrentCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void rotate();
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="FICONTER-RECOVERY-1.…"
            className="mt-4 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none transition focus:border-white/30"
          />
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
          <button
            type="button"
            disabled={busy || !currentCode.trim()}
            onClick={() => void rotate()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {busy ? "Replacing code…" : "Rotate recovery code"}
          </button>
        </div>
      </div>
    </section>
  );
}
