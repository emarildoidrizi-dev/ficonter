"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, LoaderCircle, ShieldCheck, TimerReset } from "lucide-react";
import type { CustomerRecoveryAccessState } from "@/lib/vaultRecovery/customerAccess";

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

      {status === "claimed" ? (
        <div style={{ border: "1px solid rgba(41,120,88,.28)", borderRadius: 14, padding: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <CheckCircle2 size={20} />
          <div><strong>Recovery Access claimed</strong><div style={{ marginTop: 4, fontSize: 13, opacity: .72 }}>This signed-in account has claimed the temporary authorization. The next protected step is same-Vault-key restoration and generation of a replacement recovery credential on your device.</div>{access.claimedAt ? <div style={{ marginTop: 6, fontSize: 12, opacity: .58 }}>Claimed {fmt(access.claimedAt)}</div> : null}</div>
        </div>
      ) : null}

      {status === "expired" ? (
        <div style={{ border: "1px solid rgba(160,110,30,.3)", borderRadius: 14, padding: 16 }}><strong>Recovery Access expired</strong><div style={{ marginTop: 4, fontSize: 13, opacity: .7 }}>For security, this authorization can no longer be used. FICONTER Support must issue a new temporary Recovery Access.</div></div>
      ) : null}

      {status === "revoked" || status === "failed" ? (
        <div style={{ border: "1px solid rgba(170,60,60,.28)", borderRadius: 14, padding: 16 }}><strong>Recovery Access {status}</strong><div style={{ marginTop: 4, fontSize: 13, opacity: .7 }}>This authorization cannot be used. Contact FICONTER Support if recovery still needs to continue.</div></div>
      ) : null}

      <div style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12, opacity: .62 }}><ShieldCheck size={16} style={{ flex: "0 0 auto" }} /><span>Recovery authorization and Vault decryption are separate security steps. Claiming Recovery Access does not decrypt financial records by itself.</span></div>
      {error ? <div role="alert" style={{ padding: 12, borderRadius: 10, background: "rgba(180,50,50,.08)" }}>{error}</div> : null}
    </div>
  );
}
