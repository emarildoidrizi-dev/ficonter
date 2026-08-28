"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";

export function VaultRecoveryConsentSignature({
  recoveryRequestId,
  fullName,
  alreadySigned,
  signedAt,
}: {
  recoveryRequestId: string;
  fullName: string;
  alreadySigned: boolean;
  signedAt: string | null;
}) {
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(alreadySigned);
  const [submittedAt, setSubmittedAt] = useState(signedAt);
  const [error, setError] = useState("");

  async function submit() {
    if (submitting || submitted || !signature.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/vault-recovery/${recoveryRequestId}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: signature.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The signed consent could not be submitted.");
      setSubmitted(true);
      setSubmittedAt(data.signedAt ?? new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "The signed consent could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ border: "1px solid rgba(40,120,80,.24)", borderRadius: 14, padding: 16, background: "rgba(40,120,80,.06)" }}>
        <div style={{ display: "flex", gap: 9, alignItems: "center", fontWeight: 750 }}>
          <CheckCircle2 size={18} /> Signed document submitted
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: .72 }}>
          {submittedAt ? `FICONTER recorded your consent on ${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Berlin" }).format(new Date(submittedAt))}.` : "FICONTER recorded your electronic consent."}
        </div>
      </div>
    );
  }

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16 }}>Electronic signature</h3>
        <p style={{ margin: "5px 0 0", fontSize: 13, opacity: .72 }}>
          Type your full legal name in the signature box. Submitting from your authenticated FICONTER account records this as your electronic signature for this recovery request.
        </p>
      </div>
      <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 700 }}>
        <span>Signature</span>
        <input
          value={signature}
          onChange={(event) => setSignature(event.target.value)}
          placeholder={fullName || "Type your full legal name"}
          autoComplete="name"
          maxLength={500}
          style={{ minHeight: 54, borderRadius: 12, border: "1px solid rgba(120,120,120,.28)", padding: "0 14px", fontSize: 18, fontFamily: "cursive", background: "rgba(255,255,255,.7)", color: "inherit" }}
        />
      </label>
      {error ? <div role="alert" style={{ fontSize: 13, color: "#a33" }}>{error}</div> : null}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          disabled={submitting || !signature.trim()}
          onClick={() => void submit()}
          style={{ minHeight: 44, borderRadius: 11, border: "1px solid currentColor", padding: "0 16px", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 750, opacity: signature.trim() ? 1 : .45, cursor: signature.trim() ? "pointer" : "not-allowed", background: "rgba(255,255,255,.72)", color: "inherit" }}
        >
          <Send size={16} />{submitting ? "Sending…" : "Send signed document"}
        </button>
      </div>
    </section>
  );
}
