"use client";

import { useMemo, useRef, useState } from "react";
import {
  Archive,
  Ban,
  CheckCircle2,
  FileCheck2,
  FileText,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  XCircle,
} from "lucide-react";
import type { RecoveryCustomer, VaultRecoveryCase } from "@/lib/admin/vaultRecovery";

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(120,120,120,.18)",
  borderRadius: 18,
  padding: 20,
  background: "rgba(255,255,255,.025)",
  boxShadow: "0 8px 30px rgba(0,0,0,.04)",
};

const buttonStyle: React.CSSProperties = {
  minHeight: 40,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid rgba(120,120,120,.24)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  cursor: "pointer",
  fontWeight: 650,
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  border: "1px solid currentColor",
};

function fmt(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusPill({ value }: { value: string }) {
  return (
    <span style={{
      border: "1px solid rgba(120,120,120,.22)",
      borderRadius: 999,
      padding: "6px 10px",
      fontSize: 12,
      fontWeight: 750,
      whiteSpace: "nowrap",
    }}>
      {statusLabel(value)}
    </span>
  );
}

export function VaultRecoveryCaseManager({
  initialCustomers,
  initialCases,
}: {
  initialCustomers: RecoveryCustomer[];
  initialCases: VaultRecoveryCase[];
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [cases, setCases] = useState(initialCases);
  const [query, setQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploadingCaseId, setUploadingCaseId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );

  const searchResults = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return [];
    return customers
      .filter((customer) =>
        customer.email.toLocaleLowerCase().includes(term) ||
        customer.name.toLocaleLowerCase().includes(term),
      )
      .slice(0, 12);
  }, [customers, query]);

  const activeCases = cases.filter((item) => !item.archivedAt);
  const archivedCases = cases.filter((item) => Boolean(item.archivedAt));

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/vault-recovery", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not refresh recovery cases.");
      setCustomers(data.customers ?? []);
      setCases(data.cases ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh recovery cases.");
    } finally {
      setBusy(false);
    }
  }

  async function generateForCustomer() {
    if (!selectedCustomer || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/vault-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedCustomer.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not generate recovery document.");
      await refresh();
      setQuery("");
      setSelectedCustomerId("");
      window.open(data.documentUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate recovery document.");
      setBusy(false);
    }
  }

  async function patchCase(caseId: string, body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/vault-recovery/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update recovery case.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update recovery case.");
      setBusy(false);
    }
  }

  async function deleteCase(item: VaultRecoveryCase) {
    if (busy) return;
    const confirmed = window.confirm(
      `Permanently delete ${item.reference}? This cannot be undone. Approved or completed recovery records cannot be deleted.`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/vault-recovery/${item.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete recovery case.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete recovery case.");
      setBusy(false);
    }
  }

  async function generateDocument(caseId: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/vault-recovery/${caseId}/document`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not generate consent document.");
      await refresh();
      window.open(data.documentUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate consent document.");
      setBusy(false);
    }
  }

  async function uploadSignedConsent(caseId: string, file: File) {
    if (busy || uploadingCaseId) return;
    setBusy(true);
    setUploadingCaseId(caseId);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/admin/vault-recovery/${caseId}/signed-consent`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not upload signed consent.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload signed consent.");
      setBusy(false);
    } finally {
      setUploadingCaseId(null);
    }
  }

  function primaryAction(item: VaultRecoveryCase) {
    const latest = item.documents[0];
    const signedUploaded = Boolean(latest?.signedFileName);

    if (item.status === "opened") {
      return <button style={primaryButtonStyle} disabled={busy} onClick={() => void patchCase(item.id, { action: "start_verification" })}><UserCheck size={15}/>Start verification</button>;
    }
    if (item.status === "verification_pending") {
      return <button style={primaryButtonStyle} disabled={busy} onClick={() => void generateDocument(item.id)}><FileText size={15}/>Generate consent document</button>;
    }
    if (item.status === "consent_pending") {
      return (
        <>
          <input
            ref={(element) => { fileInputs.current[item.id] = element; }}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void uploadSignedConsent(item.id, file);
            }}
          />
          <button style={primaryButtonStyle} disabled={busy} onClick={() => fileInputs.current[item.id]?.click()}>
            <Upload size={15}/>{uploadingCaseId === item.id ? "Uploading…" : signedUploaded ? "Replace signed consent" : "Upload signed consent"}
          </button>
          <button
            style={{ ...buttonStyle, opacity: signedUploaded ? 1 : .5 }}
            disabled={busy || !signedUploaded}
            title={!signedUploaded ? "Upload the signed consent document first." : undefined}
            onClick={() => void patchCase(item.id, { action: "mark_consent_signed" })}
          >
            <CheckCircle2 size={15}/>Mark consent signed
          </button>
        </>
      );
    }
    if (item.status === "consent_signed") {
      return <button style={primaryButtonStyle} disabled={busy} onClick={() => void patchCase(item.id, { action: "approve" })}><ShieldCheck size={15}/>Approve recovery</button>;
    }
    if (item.status === "approved") {
      return <button style={{ ...primaryButtonStyle, opacity: .5, cursor: "not-allowed" }} disabled title="Available after the assisted-recovery cryptographic service is implemented."><KeyRound size={15}/>Generate recovery access</button>;
    }
    return null;
  }

  function renderCase(item: VaultRecoveryCase, archived = false) {
    const latest = item.documents[0];
    const terminal = ["completed", "rejected", "cancelled"].includes(item.status);
    const signedUploaded = Boolean(latest?.signedFileName);

    return (
      <article key={item.id} style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ fontSize: 18 }}>{item.reference}</strong>
              <StatusPill value={item.status}/>
            </div>
            <div style={{ marginTop: 8, fontSize: 16, fontWeight: 650 }}>{item.customerName || "Name not provided"}</div>
            <div style={{ marginTop: 3, opacity: .76 }}>{item.customerEmail}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, marginTop: 18 }}>
          <div><div style={{ fontSize: 11, opacity: .58, fontWeight: 750, letterSpacing: ".06em" }}>ACCOUNT ID</div><div style={{ marginTop: 4, fontSize: 13, overflowWrap: "anywhere" }}>{item.userId}</div></div>
          <div><div style={{ fontSize: 11, opacity: .58, fontWeight: 750, letterSpacing: ".06em" }}>COUNTRY / REGION</div><div style={{ marginTop: 4 }}>{item.countryRegion || "Not set"}</div></div>
          <div><div style={{ fontSize: 11, opacity: .58, fontWeight: 750, letterSpacing: ".06em" }}>OPENED</div><div style={{ marginTop: 4 }}>{fmt(item.createdAt)}</div></div>
        </div>

        {latest ? (
          <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "rgba(120,120,120,.07)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700 }}><FileText size={15}/>{latest.documentId}</div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: .66 }}>Generated {fmt(latest.generatedAt)}</div>
                {signedUploaded ? <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}><FileCheck2 size={15}/>{latest.signedFileName}{latest.signedUploadedAt ? ` · ${fmt(latest.signedUploadedAt)}` : ""}</div> : null}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a style={{ ...buttonStyle, textDecoration: "none" }} href={`/dashboard/admin/support/vault-recovery/${item.id}/consent`} target="_blank" rel="noreferrer">Open document</a>
                {signedUploaded ? <a style={{ ...buttonStyle, textDecoration: "none" }} href={`/api/admin/vault-recovery/${item.id}/signed-consent`} target="_blank" rel="noreferrer">Open signed copy</a> : null}
              </div>
            </div>
          </div>
        ) : null}

        {!archived ? (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(120,120,120,.14)" }}>
            <div style={{ fontSize: 12, opacity: .6, fontWeight: 750, marginBottom: 9 }}>NEXT STEP</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{primaryAction(item)}</div>
          </div>
        ) : null}

        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {!archived && !terminal && item.status !== "approved" ? <button style={buttonStyle} disabled={busy} onClick={() => void patchCase(item.id, { action: "reject" })}><XCircle size={14}/>Reject</button> : null}
          {!archived && !terminal ? <button style={buttonStyle} disabled={busy} onClick={() => void patchCase(item.id, { action: "cancel" })}><Ban size={14}/>Cancel</button> : null}
          {archived ? <button style={buttonStyle} disabled={busy} onClick={() => void patchCase(item.id, { action: "restore" })}><RotateCcw size={14}/>Restore</button> : <button style={buttonStyle} disabled={busy} onClick={() => void patchCase(item.id, { action: "archive" })}><Archive size={14}/>Archive</button>}
          {archived ? <button style={{ ...buttonStyle, border: "1px solid rgba(180,50,50,.45)" }} disabled={busy} onClick={() => void deleteCase(item)}><Trash2 size={14}/>Delete permanently</button> : null}
        </div>
      </article>
    );
  }

  return (
    <section style={{ padding: "28px clamp(16px,3vw,32px) 48px", maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: 11, letterSpacing: ".12em", fontWeight: 750, opacity: .64 }}>PRIVATE ADMINISTRATION</span>
          <h1 style={{ fontSize: "clamp(28px,4vw,36px)", margin: "6px 0 8px" }}>Vault recovery</h1>
          <p style={{ margin: 0, opacity: .7, maxWidth: 680 }}>Find a customer by name or email and generate the official recovery consent document.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(31,90,76,.2)", borderRadius: 999, padding: "8px 12px", fontSize: 13 }}><ShieldCheck size={16}/>Admin protected</div>
      </header>

      <div style={{ ...cardStyle, marginBottom: 24, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 10 }}>Find customer</div>
        <div style={{ position: "relative" }}>
          <Search size={18} style={{ position: "absolute", left: 13, top: 13, opacity: .55, pointerEvents: "none" }}/>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedCustomerId("");
            }}
            placeholder="Search by customer name or email address"
            autoComplete="off"
            style={{ width: "100%", minHeight: 46, borderRadius: 11, padding: "0 14px 0 42px", boxSizing: "border-box" }}
          />

          {query.trim() ? (
            <div style={{ marginTop: 8, border: "1px solid rgba(120,120,120,.18)", borderRadius: 12, overflow: "hidden", maxHeight: 330, overflowY: "auto" }}>
              {searchResults.map((customer) => {
                const selected = selectedCustomerId === customer.id;
                return (
                  <button
                    type="button"
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    style={{
                      width: "100%",
                      border: 0,
                      borderBottom: "1px solid rgba(120,120,120,.12)",
                      padding: "12px 14px",
                      textAlign: "left",
                      cursor: "pointer",
                      background: selected ? "rgba(120,120,120,.12)" : "transparent",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{customer.name || "Name not provided"}</div>
                    <div style={{ marginTop: 3, fontSize: 13, opacity: .72 }}>{customer.email}</div>
                  </button>
                );
              })}
              {!searchResults.length ? <div style={{ padding: 16, opacity: .65 }}>No customer found with that name or email.</div> : null}
            </div>
          ) : null}
        </div>

        {selectedCustomer ? (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", padding: 14, borderRadius: 12, background: "rgba(120,120,120,.07)" }}>
            <div>
              <div style={{ fontWeight: 750 }}>{selectedCustomer.name || "Name not provided"}</div>
              <div style={{ marginTop: 3, fontSize: 13, opacity: .72 }}>{selectedCustomer.email}</div>
            </div>
            <button type="button" disabled={busy} onClick={() => void generateForCustomer()} style={primaryButtonStyle}>
              {busy ? <LoaderCircle size={16}/> : <FileText size={16}/>}Generate document
            </button>
          </div>
        ) : null}
      </div>

      {error ? <div role="alert" style={{ padding: 13, borderRadius: 11, marginBottom: 18, background: "rgba(180,50,50,.08)", border: "1px solid rgba(180,50,50,.2)" }}>{error}</div> : null}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Active cases <span style={{ opacity: .5, fontWeight: 500 }}>({activeCases.length})</span></h2>
        <button type="button" onClick={() => void refresh()} disabled={busy} style={buttonStyle}><RefreshCw size={15}/>Refresh</button>
      </div>
      <div style={{ display: "grid", gap: 14 }}>{activeCases.map((item) => renderCase(item))}{!activeCases.length ? <div style={{ ...cardStyle, textAlign: "center", opacity: .65 }}>No active Vault recovery cases.</div> : null}</div>

      <details style={{ marginTop: 28 }}>
        <summary style={{ cursor: "pointer", fontSize: 18, fontWeight: 750, padding: "8px 0" }}>Archived cases ({archivedCases.length})</summary>
        <div style={{ display: "grid", gap: 14, marginTop: 10 }}>{archivedCases.map((item) => renderCase(item, true))}{!archivedCases.length ? <div style={{ padding: 16, opacity: .6 }}>No archived cases.</div> : null}</div>
      </details>
    </section>
  );
}
