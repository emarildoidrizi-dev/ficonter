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
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  XCircle,
} from "lucide-react";
import type { RecoveryCustomer, VaultRecoveryCase } from "@/lib/admin/vaultRecovery";
import { FICONTER_COUNTRIES } from "@/lib/countries";

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(120,120,120,.18)",
  borderRadius: 18,
  padding: 20,
  background: "rgba(255,255,255,.025)",
  boxShadow: "0 8px 30px rgba(0,0,0,.04)",
};

const buttonStyle: React.CSSProperties = {
  minHeight: 38,
  padding: "0 13px",
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
  const [customerId, setCustomerId] = useState(initialCustomers[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingCaseId, setUploadingCaseId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [draft, setDraft] = useState({
    customerEmail: "",
    customerName: "",
    countryRegion: "",
    internalNotes: "",
  });

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? null,
    [customerId, customers],
  );
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
      if (!customerId && data.customers?.[0]) setCustomerId(data.customers[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh recovery cases.");
    } finally {
      setBusy(false);
    }
  }

  async function createCase() {
    if (!selectedCustomer || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/vault-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedCustomer.id, customerEmail: selectedCustomer.email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create recovery case.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create recovery case.");
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
      setEditingId(null);
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

  function beginEdit(item: VaultRecoveryCase) {
    setEditingId(item.id);
    setDraft({
      customerEmail: item.customerEmail,
      customerName: item.customerName,
      countryRegion: item.countryRegion,
      internalNotes: item.internalNotes,
    });
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
    const editing = editingId === item.id;
    const terminal = ["completed", "rejected", "cancelled"].includes(item.status);
    const signedUploaded = Boolean(latest?.signedFileName);
    const countryOptions = draft.countryRegion && !FICONTER_COUNTRIES.includes(draft.countryRegion as (typeof FICONTER_COUNTRIES)[number])
      ? [draft.countryRegion, ...FICONTER_COUNTRIES]
      : FICONTER_COUNTRIES;

    return (
      <article key={item.id} style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ fontSize: 18 }}>{item.reference}</strong>
              <StatusPill value={item.status}/>
            </div>
            <div style={{ marginTop: 8, fontSize: 16, fontWeight: 650 }}>{item.customerName || "Unnamed customer"}</div>
            <div style={{ marginTop: 3, opacity: .76 }}>{item.customerEmail}</div>
          </div>
          {!archived && !terminal ? <button style={buttonStyle} disabled={busy} onClick={() => beginEdit(item)}><Pencil size={14}/>Edit details</button> : null}
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

        {editing ? (
          <div style={{ marginTop: 18, padding: 16, border: "1px solid rgba(120,120,120,.15)", borderRadius: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}><strong style={{ fontSize: 13 }}>Recovery contact email</strong><input type="email" value={draft.customerEmail} onChange={(e) => setDraft({ ...draft, customerEmail: e.target.value })} style={{ minHeight: 42, borderRadius: 9, padding: "0 10px" }}/></label>
            <label style={{ display: "grid", gap: 6 }}><strong style={{ fontSize: 13 }}>Customer full name</strong><input value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value })} style={{ minHeight: 42, borderRadius: 9, padding: "0 10px" }}/></label>
            <label style={{ display: "grid", gap: 6 }}><strong style={{ fontSize: 13 }}>Country / region</strong><select value={draft.countryRegion} onChange={(e) => setDraft({ ...draft, countryRegion: e.target.value })} style={{ minHeight: 42, borderRadius: 9, padding: "0 10px" }}><option value="">Select country / region</option>{countryOptions.map((country) => <option key={country} value={country}>{country}</option>)}</select></label>
            <label style={{ display: "grid", gap: 6 }}><strong style={{ fontSize: 13 }}>Internal notes</strong><textarea value={draft.internalNotes} onChange={(e) => setDraft({ ...draft, internalNotes: e.target.value })} style={{ minHeight: 86, borderRadius: 9, padding: 10 }}/></label>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap" }}><button style={primaryButtonStyle} disabled={busy} onClick={() => void patchCase(item.id, { action: "edit", ...draft })}>Save changes</button><button style={buttonStyle} disabled={busy} onClick={() => setEditingId(null)}>Cancel</button></div>
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
          <p style={{ margin: 0, opacity: .7, maxWidth: 680 }}>Manage customer recovery requests in a clear sequence: verify, obtain consent, approve, and recover.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(31,90,76,.2)", borderRadius: 999, padding: "8px 12px", fontSize: 13 }}><ShieldCheck size={16}/>Admin protected</div>
      </header>

      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 10 }}>Create a recovery case</div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10 }}>
          <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} style={{ minHeight: 44, borderRadius: 10, padding: "0 12px", minWidth: 0 }}>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.email}</option>)}
          </select>
          <button type="button" disabled={!selectedCustomer || busy} onClick={() => void createCase()} style={primaryButtonStyle}>{busy ? <LoaderCircle size={16}/> : <Plus size={16}/>}Create case</button>
        </div>
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
