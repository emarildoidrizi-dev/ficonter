"use client";

import { useRef, useState } from "react";
import { CheckCircle2, KeyRound, LoaderCircle, ShieldCheck, TimerReset } from "lucide-react";
import type { CustomerRecoveryAccessState } from "@/lib/vaultRecovery/customerAccess";
import { createClient } from "@/lib/supabase/client";
import {
  createReplacementRecoveryForRawVaultKey,
  rotateRecoveryCodeForSameVaultKey,
} from "@/lib/e2ee/recoveryCodeRotation";
import type { WrappedVaultKeyEnvelopeV1 } from "@/lib/e2ee/vault";
import type { EmergencyRecoveryPublicKeyV1 } from "@/lib/e2ee/emergencyRecoveryEnvelope";
import {
  createCustomerRecoveryEphemeralKey,
  unwrapCustomerRecoveryVaultKey,
  type CustomerRecoveryEphemeralKeyV1,
  type CustomerWrappedVaultKeyV1,
} from "@/lib/e2ee/customerRecoveryKey";
import { setActiveVaultKey } from "@/lib/e2ee/sessionKey";
import { rememberVaultKeyForBrowserSession } from "@/lib/e2ee/browserVaultSession";

function fmt(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

const buttonStyle: React.CSSProperties = {
  minHeight: 44,
  padding: "0 16px",
  borderRadius: 11,
  border: "1px solid currentColor",
  background: "transparent",
  color: "inherit",
  fontWeight: 750,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  borderRadius: 11,
  border: "1px solid rgba(120,120,120,.26)",
  background: "rgba(255,255,255,.7)",
  color: "inherit",
  padding: "0 12px",
  fontFamily: "monospace",
};

export function VaultRecoveryCustomerAccess({
  recoveryRequestId,
  initialAccess,
}: {
  recoveryRequestId: string;
  initialAccess: CustomerRecoveryAccessState | null;
}) {
  const [access, setAccess] = useState(initialAccess);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [currentRecoveryCode, setCurrentRecoveryCode] = useState("");
  const [replacementRecoveryCode, setReplacementRecoveryCode] = useState("");
  const ephemeralRecoveryKeyRef = useRef<CustomerRecoveryEphemeralKeyV1 | null>(null);

  async function claim() {
    if (busy || !access) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/vault-recovery/${recoveryRequestId}/access`, {
        method: "POST",
      });
      const data = await response.json();
      if (data.access) setAccess(data.access);
      if (!response.ok) throw new Error(data.error ?? "Recovery Access could not be claimed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery Access could not be claimed.");
    } finally {
      setBusy(false);
    }
  }

  async function rotateRecoveryCredential() {
    if (busy || !access || !currentRecoveryCode.trim()) return;
    setBusy(true);
    setError("");
    setReplacementRecoveryCode("");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please log in again before rotating the Vault recovery credential.");
      }

      const { data: vaultRecord, error: vaultError } = await supabase
        .from("user_financial_vaults")
        .select("wrapped_vault_key,recovery_version")
        .eq("user_id", user.id)
        .single();

      if (vaultError || !vaultRecord) {
        throw new Error("Financial Vault could not be found.");
      }

      const accessResponse = await fetch(`/api/vault-recovery/${recoveryRequestId}/access`, {
        method: "GET",
        cache: "no-store",
      });
      const accessData = await accessResponse.json();
      if (!accessResponse.ok) {
        throw new Error(accessData.error ?? "Recovery Access could not be verified.");
      }

      const recoveryPublicKey = accessData.recoveryPublicKey as EmergencyRecoveryPublicKeyV1 | null;
      if (!recoveryPublicKey) {
        throw new Error("Assisted Recovery protection is not configured yet. No Vault changes were made.");
      }

      const expectedRecoveryVersion = Math.max(1, Number(vaultRecord.recovery_version ?? 1));
      const rotated = await rotateRecoveryCodeForSameVaultKey({
        userId: user.id,
        currentRecoveryCode: currentRecoveryCode.trim(),
        envelope: vaultRecord.wrapped_vault_key as WrappedVaultKeyEnvelopeV1,
        emergencyRecoveryPublicKey: recoveryPublicKey,
      });

      if (!rotated.emergencyRecoveryEnvelope) {
        throw new Error("Emergency recovery protection could not be created.");
      }

      const completionResponse = await fetch(
        `/api/vault-recovery/${recoveryRequestId}/complete-bootstrap`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedRecoveryVersion,
            wrappedVaultKey: rotated.wrappedVaultKey,
            emergencyEnvelope: rotated.emergencyRecoveryEnvelope,
          }),
        },
      );
      const completionData = await completionResponse.json();
      if (!completionResponse.ok) {
        throw new Error(completionData.error ?? "Vault recovery bootstrap could not be completed.");
      }

      setActiveVaultKey(rotated.vaultKey);
      await rememberVaultKeyForBrowserSession(user.id, rotated.vaultKey);
      setCurrentRecoveryCode("");
      setReplacementRecoveryCode(rotated.recoveryCode);
      setAccess((previous) => previous ? {
        ...previous,
        status: "completed",
        effectiveStatus: "completed",
      } : previous);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery credential could not be rotated.");
    } finally {
      setBusy(false);
    }
  }

  async function recoverWithoutRecoveryCode() {
    if (busy || !access) return;
    setBusy(true);
    setError("");
    setReplacementRecoveryCode("");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please log in again before starting Assisted Recovery.");
      }

      const { data: vaultRecord, error: vaultError } = await supabase
        .from("user_financial_vaults")
        .select("recovery_version")
        .eq("user_id", user.id)
        .single();

      if (vaultError || !vaultRecord) {
        throw new Error("Financial Vault could not be found.");
      }

      const expectedRecoveryVersion = Math.max(1, Number(vaultRecord.recovery_version ?? 1));

      let ephemeralKey = ephemeralRecoveryKeyRef.current;
      if (!ephemeralKey) {
        ephemeralKey = await createCustomerRecoveryEphemeralKey();
        ephemeralRecoveryKeyRef.current = ephemeralKey;
      }

      const bindingResponse = await fetch(
        `/api/vault-recovery/${recoveryRequestId}/bind-customer-key`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            algorithm: ephemeralKey.alg,
            publicJwk: ephemeralKey.publicJwk,
          }),
        },
      );
      const bindingData = await bindingResponse.json();
      if (!bindingResponse.ok) {
        throw new Error(bindingData.error ?? "Customer recovery key could not be bound.");
      }

      const materialResponse = await fetch(
        `/api/vault-recovery/${recoveryRequestId}/recovery-material`,
        { method: "POST" },
      );
      const materialData = await materialResponse.json();
      if (!materialResponse.ok) {
        throw new Error(materialData.error ?? "Protected recovery material could not be issued.");
      }

      const recoveryAccessId = String(materialData.recoveryAccessId ?? "");
      const wrappedForCustomer = materialData.wrappedVaultKey as CustomerWrappedVaultKeyV1;
      const rawVaultKey = await unwrapCustomerRecoveryVaultKey({
        userId: user.id,
        recoveryAccessId,
        privateKey: ephemeralKey.privateKey,
        wrapped: wrappedForCustomer,
      });

      let replacement;
      try {
        replacement = await createReplacementRecoveryForRawVaultKey({
          userId: user.id,
          rawVaultKey,
        });
      } finally {
        rawVaultKey.fill(0);
      }

      const completionResponse = await fetch(
        `/api/vault-recovery/${recoveryRequestId}/complete-assisted`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedRecoveryVersion,
            wrappedVaultKey: replacement.wrappedVaultKey,
          }),
        },
      );
      const completionData = await completionResponse.json();
      if (!completionResponse.ok) {
        throw new Error(completionData.error ?? "Assisted Recovery could not be completed.");
      }

      setActiveVaultKey(replacement.vaultKey);
      await rememberVaultKeyForBrowserSession(user.id, replacement.vaultKey);
      setReplacementRecoveryCode(replacement.recoveryCode);
      ephemeralRecoveryKeyRef.current = null;
      setAccess((previous) => previous ? {
        ...previous,
        status: "completed",
        effectiveStatus: "completed",
      } : previous);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assisted Recovery could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (!access) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <strong>No Recovery Access is currently available.</strong>
        <span style={{ fontSize: 13, opacity: .68 }}>FICONTER Support must finish verification and authorize this recovery request before secure recovery can begin.</span>
      </div>
    );
  }

  const status = access.effectiveStatus;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
        <div><div style={{ fontSize: 10, fontWeight: 750, opacity: .55, textTransform: "uppercase" }}>Recovery Access ID</div><div style={{ marginTop: 4, fontSize: 13, overflowWrap: "anywhere" }}>{access.id}</div></div>
        <div><div style={{ fontSize: 10, fontWeight: 750, opacity: .55, textTransform: "uppercase" }}>Issued</div><div style={{ marginTop: 4, fontSize: 13 }}>{fmt(access.issuedAt)}</div></div>
        <div><div style={{ fontSize: 10, fontWeight: 750, opacity: .55, textTransform: "uppercase" }}>Expires</div><div style={{ marginTop: 4, fontSize: 13 }}>{fmt(access.expiresAt)}</div></div>
      </div>

      {status === "issued" ? (
        <div style={{ border: "1px solid rgba(120,120,120,.18)", borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <TimerReset size={20} />
            <div><strong>Temporary Recovery Access is ready</strong><div style={{ marginTop: 4, fontSize: 13, opacity: .7 }}>This authorization is bound to your signed-in FICONTER account and expires automatically. It does not expose your Vault key to FICONTER staff.</div></div>
          </div>
          <div><button type="button" style={buttonStyle} disabled={busy} onClick={() => void claim()}>{busy ? <LoaderCircle size={17} /> : <KeyRound size={17} />}{busy ? "Claiming…" : "Begin secure recovery"}</button></div>
        </div>
      ) : null}

      {status === "claimed" && !replacementRecoveryCode ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ border: "1px solid rgba(41,120,88,.28)", borderRadius: 14, padding: 16, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <CheckCircle2 size={20} />
              <div><strong>Recovery Access claimed</strong><div style={{ marginTop: 4, fontSize: 13, opacity: .72 }}>Choose the recovery path that matches your situation. Both paths preserve the same encrypted Vault and existing financial records.</div>{access.claimedAt ? <div style={{ marginTop: 6, fontSize: 12, opacity: .58 }}>Claimed {fmt(access.claimedAt)}</div> : null}</div>
            </div>
          </div>

          <div style={{ border: "1px solid rgba(120,120,120,.18)", borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
            <div><strong>I still have my current recovery code</strong><div style={{ marginTop: 4, fontSize: 13, opacity: .7 }}>Use this once to activate the emergency recovery envelope and rotate to a new code.</div></div>
            <div style={{ display: "grid", gap: 8 }}>
              <label htmlFor="current-vault-recovery-code" style={{ fontSize: 12, fontWeight: 800 }}>Current recovery code</label>
              <input
                id="current-vault-recovery-code"
                type="password"
                autoComplete="off"
                spellCheck={false}
                style={inputStyle}
                value={currentRecoveryCode}
                onChange={(event) => setCurrentRecoveryCode(event.target.value)}
                placeholder="FICONTER-RECOVERY-1.…"
              />
            </div>
            <div>
              <button
                type="button"
                style={buttonStyle}
                disabled={busy || !currentRecoveryCode.trim()}
                onClick={() => void rotateRecoveryCredential()}
              >
                {busy ? <LoaderCircle size={17} /> : <KeyRound size={17} />}
                {busy ? "Protecting Vault…" : "Generate replacement recovery code"}
              </button>
            </div>
          </div>

          <div style={{ border: "1px solid rgba(120,120,120,.18)", borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
            <div><strong>I no longer have my recovery code</strong><div style={{ marginTop: 4, fontSize: 13, opacity: .7 }}>Use FICONTER Assisted Recovery. A temporary key is created in this browser, the managed recovery boundary re-wraps the same Vault key specifically to this session, and your browser creates a new recovery code.</div></div>
            <div>
              <button
                type="button"
                style={buttonStyle}
                disabled={busy}
                onClick={() => void recoverWithoutRecoveryCode()}
              >
                {busy ? <LoaderCircle size={17} /> : <ShieldCheck size={17} />}
                {busy ? "Recovering Vault…" : "Recover without old code"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {replacementRecoveryCode ? (
        <div style={{ border: "1px solid rgba(41,120,88,.34)", borderRadius: 14, padding: 18, display: "grid", gap: 12 }}>
          <div><strong>Vault recovery completed</strong><div style={{ marginTop: 5, fontSize: 13, opacity: .72 }}>Save this new recovery code now. The previous recovery credential is no longer active. The same underlying Vault key was preserved, so your existing encrypted financial records remain tied to the same Vault.</div></div>
          <code style={{ padding: 14, borderRadius: 10, background: "rgba(41,120,88,.08)", overflowWrap: "anywhere", userSelect: "all" }}>{replacementRecoveryCode}</code>
          <div style={{ fontSize: 12, opacity: .65 }}>FICONTER staff do not receive the readable Vault key or this replacement recovery code.</div>
        </div>
      ) : null}

      {status === "expired" ? (
        <div style={{ border: "1px solid rgba(160,110,30,.3)", borderRadius: 14, padding: 16 }}><strong>Recovery Access expired</strong><div style={{ marginTop: 4, fontSize: 13, opacity: .7 }}>For security, this authorization can no longer be used. FICONTER Support must issue a new temporary Recovery Access.</div></div>
      ) : null}

      {status === "revoked" || status === "failed" ? (
        <div style={{ border: "1px solid rgba(170,60,60,.28)", borderRadius: 14, padding: 16 }}><strong>Recovery Access {status}</strong><div style={{ marginTop: 4, fontSize: 13, opacity: .7 }}>This authorization cannot be used. Contact FICONTER Support if recovery still needs to continue.</div></div>
      ) : null}

      {status === "completed" && !replacementRecoveryCode ? (
        <div style={{ border: "1px solid rgba(41,120,88,.28)", borderRadius: 14, padding: 16 }}><strong>Recovery Access completed</strong><div style={{ marginTop: 4, fontSize: 13, opacity: .7 }}>This one-time authorization has already been consumed and cannot be reused.</div></div>
      ) : null}

      <div style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12, opacity: .62 }}><ShieldCheck size={16} style={{ flex: "0 0 auto" }} /><span>Recovery authorization and Vault decryption remain separate security steps. Assisted Recovery preserves the existing Vault encryption key instead of creating an empty Vault.</span></div>
      {error ? <div role="alert" style={{ padding: 12, borderRadius: 10, background: "rgba(180,50,50,.08)" }}>{error}</div> : null}
    </div>
  );
}
