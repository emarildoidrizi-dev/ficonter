"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Ban,
  FileCheck2,
  FileText,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { RecoveryDirectoryCustomer } from "@/lib/admin/recoveryDirectory";
import type { VaultRecoveryCase } from "@/lib/admin/vaultRecovery";
import type { VaultRecoveryAccessState } from "@/lib/admin/vaultRecoveryAccess";
import { VaultRecoveryDeleteDialog } from "./VaultRecoveryDeleteDialog";

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(120,120,120,.18)",
  borderRadius: 16,
  padding: 18,
  background: "rgba(255,255,255,.025)",
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

const primaryButtonStyle: React.CSSProperties = { ...buttonStyle, border: "1px solid currentColor" };

function fmt(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value));
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type DeliveryDocument = VaultRecoveryCase["documents"][number] & {
  sentToCustomerAt?: string | null;
  customerSignedAt?: string | null;
  customerSignatureMethod?: string | null;
};

type RecoveryCase = VaultRecoveryCase & {
  recoveryAccess?: VaultRecoveryAccessState | null;
};

function workflowLabel(item: RecoveryCase, latest?: DeliveryDocument) {
  if (item.status === "completed") return "Recovery Completed";
  if (item.status === "approved") return "Recovery Approved";
  if (item.status === "recovery_issued") {
    if (item.recoveryAccess?.effectiveStatus === "expired") return "Recovery Access Expired";
    if (item.recoveryAccess?.effectiveStatus === "revoked") return "Recovery Access Revoked";
    if (item.recoveryAccess?.effectiveStatus === "failed") return "Recovery Access Failed";
    return "Recovery Access Issued";
  }
  if (item.status === "cancelled") return "Cancelled";
  if (item.status === "rejected") return "Rejected";
  if (latest?.customerSignedAt) return "Document Signed";
  if (latest?.sentToCustomerAt) return "Document Sent";
  return statusLabel(item.status);
}

export function VaultRecoveryCaseManager({
  initialCustomers,
  initialCases,
}: {
  initialCustomers: RecoveryDirectoryCustomer[];
  initialCases: RecoveryCase[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [customers, setCustomers] = useState(initialCustomers);
  const [cases, setCases] = useState<RecoveryCase[]>(initialCases);
  const [query, setQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploadingCaseId, setUploadingCaseId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecoveryCase | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const activeCases = cases.filter((item) => !item.archivedAt);
  const archivedCases = cases.filter((item) => Boolean(item.archivedAt));

  const searchResults = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return [];

    const caseUserIds = new Set(
      cases
        .filter((item) => item.reference.toLocaleLowerCase().includes(term))
        .map((item) => item.userId),
    );

    return customers
      .filter((customer) =>
        customer.fullName.toLocaleLowerCase().includes(term) ||
        customer.email.toLocaleLowerCase().includes(term) ||
        customer.birthDate.toLocaleLowerCase().includes(term) ||
        caseUserIds.has(customer.id),
      )
      .slice(0, 15);
  }, [cases, customers, query]);

  async function loadLatest() {
    const response = await fetch("/api/admin/vault-recovery", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not refresh recovery cases.");
    setCustomers(data.customers ?? []);
    setCases(data.cases ?? []);
  }

  useEffect(() => {
    let active = true;
    const reload = () => {
      if (!active) return;
      void loadLatest().catch(() => undefined);
    };

    const channel = supabase
      .channel("admin-vault-recovery-consent")
      .on("postgres_changes", { event: "*", schema: "public", table: "vault_recovery_documents" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "vault_recovery_requests" }, reload)
      .subscribe();

    const fallback = window.setInterval(reload, 10000);
    window.addEventListener("focus", reload);

    return () => {
      active = false;
      window.clearInterval(fallback);
      window.removeEventListener("focus", reload);
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      await loadLatest();
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
    setNotice("");
    try {
      const response = await fetch("/api/admin/vault-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedCustomer.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not generate recovery document.");
      await loadLatest();
      setQuery("");
      setSelectedCustomerId("");
      window.open(data.documentUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate recovery document.");
    } finally {
      setBusy(false);
    }
  }

  async function patchCase(caseId: string, body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/vault-recovery/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update recovery case.");
      await loadLatest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update recovery case.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCase(item: RecoveryCase) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/vault-recovery/${item.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete recovery case.");
      setPendingDelete(null);
      await loadLatest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete recovery case.");
    } finally {
      setBusy(false);
    }
  }

  async function generateDocument(caseId: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/vault-recovery/${caseId}/document`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not generate consent document.");
      await loadLatest();
      window.open(data.documentUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate consent document.");
    } finally {
      setBusy(false);
    }
  }

  async function sendDocument(caseId: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/vault-recovery/${caseId}/send-consent`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send the consent document.");
      await loadLatest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the consent document.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadSignedConsent(caseId: string, file: File) {
    if (busy || uploadingCaseId) return;
    setBusy(true);
    setUploadingCaseId(caseId);
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/admin/vault-recovery/${caseId}/signed-consent`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not upload signed consent.");
      await loadLatest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload signed consent.");
    } finally {
      setBusy(false);
      setUploadingCaseId(null);
    }
  }

  async function issueRecoveryAccess(caseId: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/vault-recovery/${caseId}/recovery-access`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not issue Recovery Access.");
      await loadLatest();
      setNotice(`Recovery Access issued. It expires ${fmt(data.grant.expiresAt)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not issue Recovery Access.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeRecoveryAccess(caseId: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/vault-recovery/${caseId}/recovery-access`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not revoke Recovery Access.");
      await loadLatest();
      setNotice("Recovery Access revoked. A new grant can be issued if recovery still needs to continue.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke Recovery Access.");
    } finally {
      setBusy(false);
    }
  }

  function primaryAction(item: RecoveryCase) {
    const latest = item.documents[0] as DeliveryDocument | undefined;
    const accessActive = Boolean(item.recoveryAccess && ["issued", "claimed"].includes(item.recoveryAccess.effectiveStatus));

    if (item.status === "opened") return <button style={primaryButtonStyle} disabled={busy} onClick={() => void patchCase(item.id, { action: "start_verification" })}><UserCheck size={15}/>Start verification</button>;
    if (item.status === "verification_pending") return <button style={primaryButtonStyle} disabled={busy} onClick={() => void generateDocument(item.id)}><FileText size={15}/>Generate consent document</button>;
    if (item.status === "consent_pending") {
      if (!latest?.sentToCustomerAt) {
        return <button style={primaryButtonStyle} disabled={busy || !latest} onClick={() => void sendDocument(item.id)}><Send size={15}/>Send document for signature</button>;
      }
      return <>
        <button style={{ ...primaryButtonStyle, opacity: .58, cursor: "default" }} disabled><FileText size={15}/>Document sent · awaiting signature</button>
        <input ref={(el) => { fileInputs.current[item.id] = el; }} type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadSignedConsent(item.id, file); }} />
        <button style={buttonStyle} disabled={busy} onClick={() => fileInputs.current[item.id]?.click()}><Upload size={15}/>{uploadingCaseId === item.id ? "Uploading…" : "Manual signed-copy fallback"}</button>
      </>;
    }
    if (item.status === "consent_signed") return <button style={primaryButtonStyle} disabled={busy} onClick={() => void patchCase(item.id, { action: "approve" })}><ShieldCheck size={15}/>Approve recovery</button>;
    if (item.status === "approved" || (item.status === "recovery_issued" && !accessActive)) {
      return <button style={primaryButtonStyle} disabled={busy} onClick={() => void issueRecoveryAccess(item.id)}><KeyRound size={15}/>{item.recoveryAccess ? "Generate new recovery access" : "Generate recovery access"}</button>;
    }
    if (item.status === "recovery_issued" && accessActive) {
      return <>
        <button style={{ ...primaryButtonStyle, opacity: .66, cursor: "default" }} disabled><KeyRound size={15}/>Recovery access active · expires {fmt(item.recoveryAccess!.expiresAt)}</button>
        <button style={buttonStyle} disabled={busy} onClick={() => void revokeRecoveryAccess(item.id)}><Ban size={15}/>Revoke recovery access</button>
      </>;
    }
    return null;
  }

  function renderCase(item: RecoveryCase, archived = false) {
    const latest = item.documents[0] as DeliveryDocument | undefined;
    const terminal = ["completed", "rejected", "cancelled"].includes(item.status);
    const signedUploaded = Boolean(latest?.signedFileName);
    const electronicallySigned = Boolean(latest?.customerSignedAt);
    return <article key={item.id} style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}><strong>{item.reference}</strong><span style={{ border: "1px solid rgba(120,120,120,.22)", borderRadius: 999, padding: "5px 9px", fontSize: 12 }}>{workflowLabel(item, latest)}</span></div>
          <div style={{ marginTop: 7, fontWeight: 650 }}>{item.customerName || "Name not provided"}</div>
          <div style={{ marginTop: 2, opacity: .72 }}>{item.customerEmail}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 15, fontSize: 13 }}>
        <div><strong>Account ID</strong><div style={{ overflowWrap: "anywhere", opacity: .75 }}>{item.userId}</div></div>
        <div><strong>Country / region</strong><div style={{ opacity: .75 }}>{item.countryRegion || "Not provided"}</div></div>
        <div><strong>Opened</strong><div style={{ opacity: .75 }}>{fmt(item.createdAt)}</div></div>
      </div>
      {latest ? <div style={{ marginTop: 15, padding: 12, borderRadius: 10, background: "rgba(120,120,120,.07)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div><FileText size={14} style={{ verticalAlign: "-2px", marginRight: 6 }}/>{latest.documentId}</div>
          <small style={{ display: "block", opacity: .65 }}>Generated {fmt(latest.generatedAt)}</small>
          {latest.sentToCustomerAt ? <small style={{ display: "block", marginTop: 3, opacity: .72 }}>Sent to customer {fmt(latest.sentToCustomerAt)}</small> : null}
          {latest.customerSignedAt ? <small style={{ display: "block", marginTop: 3, fontWeight: 700 }}>Signed & submitted {fmt(latest.customerSignedAt)}</small> : null}
          {signedUploaded && !electronicallySigned ? <div style={{ marginTop: 5, fontSize: 13 }}><FileCheck2 size={14} style={{ verticalAlign: "-2px", marginRight: 6 }}/>{latest.signedFileName}</div> : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {electronicallySigned ? (
            <a style={{ ...buttonStyle, textDecoration: "none" }} href={`/dashboard/admin/support/vault-recovery/${item.id}/signed`} target="_blank" rel="noreferrer">View signed consent</a>
          ) : signedUploaded ? (
            <a style={{ ...buttonStyle, textDecoration: "none" }} href={`/api/admin/vault-recovery/${item.id}/signed-consent`} target="_blank" rel="noreferrer">Open signed copy</a>
          ) : (
            <a style={{ ...buttonStyle, textDecoration: "none" }} href={`/dashboard/admin/support/vault-recovery/${item.id}/consent`} target="_blank" rel="noreferrer">Open consent document</a>
          )}
        </div>
      </div> : null}
      {item.recoveryAccess ? <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid rgba(120,120,120,.16)", fontSize: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 750 }}><KeyRound size={14}/>Recovery Access</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginTop: 8 }}>
          <div><strong>Status</strong><div style={{ opacity: .75 }}>{statusLabel(item.recoveryAccess.effectiveStatus)}</div></div>
          <div><strong>Issued</strong><div style={{ opacity: .75 }}>{fmt(item.recoveryAccess.issuedAt)}</div></div>
          <div><strong>Expires</strong><div style={{ opacity: .75 }}>{fmt(item.recoveryAccess.expiresAt)}</div></div>
          <div><strong>Access ID</strong><div style={{ overflowWrap: "anywhere", opacity: .75 }}>{item.recoveryAccess.id}</div></div>
        </div>
      </div> : null}
      {!archived ? <div style={{ marginTop: 15, paddingTop: 14, borderTop: "1px solid rgba(120,120,120,.14)" }}><div style={{ fontSize: 11, fontWeight: 750, opacity: .58, marginBottom: 8 }}>NEXT STEP</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{primaryAction(item)}</div></div> : null}
      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
        {!archived && !terminal && !["approved", "recovery_issued"].includes(item.status) ? <button style={buttonStyle} disabled={busy} onClick={() => void patchCase(item.id, { action: "reject" })}><XCircle size={14}/>Reject</button> : null}
        {!archived && !terminal ? <button style={buttonStyle} disabled={busy} onClick={() => void patchCase(item.id, { action: "cancel" })}><Ban size={14}/>Cancel</button> : null}
        {archived ? <button style={buttonStyle} disabled={busy} onClick={() => void patchCase(item.id, { action: "restore" })}><RotateCcw size={14}/>Restore</button> : <button style={buttonStyle} disabled={busy} onClick={() => void patchCase(item.id, { action: "archive" })}><Archive size={14}/>Archive</button>}
        {archived ? <button style={{ ...buttonStyle, borderColor: "rgba(180,50,50,.45)" }} disabled={busy} onClick={() => setPendingDelete(item)}><Trash2 size={14}/>Delete permanently</button> : null}
      </div>
    </article>;
  }

  return <section style={{ padding: "28px clamp(16px,3vw,32px) 48px", maxWidth: 1180, margin: "0 auto" }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 22 }}><div><span style={{ fontSize: 11, letterSpacing: ".12em", fontWeight: 750, opacity: .64 }}>PRIVATE ADMINISTRATION</span><h1 style={{ margin: "6px 0", fontSize: 32 }}>Vault recovery</h1><p style={{ margin: 0, opacity: .7 }}>Find a customer, generate consent, send it to their FICONTER Inbox, approve the request, and issue time-limited Recovery Access.</p></div><div style={{ alignSelf: "flex-start", display: "flex", gap: 7, alignItems: "center", border: "1px solid rgba(31,90,76,.2)", borderRadius: 999, padding: "8px 12px", fontSize: 13 }}><ShieldCheck size={15}/>Admin protected</div></header>

    <div style={{ ...cardStyle, marginBottom: 24 }}>
      <div style={{ fontWeight: 750, marginBottom: 6 }}>Find customer</div>
      <div style={{ fontSize: 13, opacity: .66, marginBottom: 12 }}>Search by full name, email address, existing recovery request ID, or birthdate.</div>
      <div style={{ position: "relative" }}>
        <Search size={17} style={{ position: "absolute", left: 13, top: 14, opacity: .55 }}/>
        <input value={query} onChange={(e) => { setQuery(e.target.value); setSelectedCustomerId(""); }} placeholder="Full name, email, RCV-2026-..., or YYYY-MM-DD" style={{ width: "100%", minHeight: 46, boxSizing: "border-box", borderRadius: 11, border: "1px solid rgba(120,120,120,.26)", padding: "0 14px 0 40px", fontSize: 15 }}/>
      </div>
      {query.trim() ? <div style={{ marginTop: 10, border: "1px solid rgba(120,120,120,.16)", borderRadius: 11, overflow: "hidden" }}>
        {searchResults.length ? searchResults.map((customer) => {
          const requestIds = cases.filter((item) => item.userId === customer.id && item.documents.length > 0).map((item) => item.reference);
          const selected = selectedCustomerId === customer.id;
          return <button key={customer.id} type="button" onClick={() => setSelectedCustomerId(customer.id)} style={{ width: "100%", textAlign: "left", padding: "11px 13px", border: 0, borderBottom: "1px solid rgba(120,120,120,.12)", background: selected ? "rgba(120,120,120,.12)" : "transparent", cursor: "pointer" }}>
            <div style={{ fontWeight: 700 }}>{customer.fullName || "Name not provided"}</div>
            <div style={{ fontSize: 13, opacity: .72 }}>{customer.email}{customer.birthDate ? ` · DOB ${customer.birthDate}` : ""}</div>
            {requestIds.length ? <div style={{ marginTop: 3, fontSize: 12, opacity: .58 }}>Recovery request: {requestIds.join(", ")}</div> : null}
          </button>;
        }) : <div style={{ padding: 13, opacity: .6 }}>No matching customer found.</div>}
      </div> : null}
      {selectedCustomer ? <div style={{ marginTop: 13, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: 13, borderRadius: 11, background: "rgba(120,120,120,.07)" }}><div><strong>{selectedCustomer.fullName || "Name not provided"}</strong><div style={{ fontSize: 13, opacity: .7 }}>{selectedCustomer.email}</div></div><button type="button" style={primaryButtonStyle} disabled={busy} onClick={() => void generateForCustomer()}>{busy ? <LoaderCircle size={16}/> : <FileText size={16}/>}Generate document</button></div> : null}
    </div>

    {error ? <div role="alert" style={{ padding: 12, borderRadius: 10, marginBottom: 17, background: "rgba(180,50,50,.08)" }}>{error}</div> : null}
    {notice ? <div role="status" style={{ padding: 12, borderRadius: 10, marginBottom: 17, background: "rgba(31,90,76,.08)" }}>{notice}</div> : null}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}><h2 style={{ margin: 0, fontSize: 20 }}>Active cases ({activeCases.length})</h2><button style={buttonStyle} disabled={busy} onClick={() => void refresh()}><RefreshCw size={14}/>Refresh</button></div>
    <div style={{ display: "grid", gap: 13 }}>{activeCases.map((item) => renderCase(item))}{!activeCases.length ? <div style={{ ...cardStyle, textAlign: "center", opacity: .62 }}>No active recovery cases.</div> : null}</div>
    <details style={{ marginTop: 26 }}><summary style={{ cursor: "pointer", fontWeight: 750 }}>Archived cases ({archivedCases.length})</summary><div style={{ display: "grid", gap: 13, marginTop: 12 }}>{archivedCases.map((item) => renderCase(item, true))}</div></details>

    <VaultRecoveryDeleteDialog
      open={Boolean(pendingDelete)}
      reference={pendingDelete?.reference ?? ""}
      customerName={pendingDelete?.customerName ?? ""}
      busy={busy}
      onCancel={() => { if (!busy) setPendingDelete(null); }}
      onConfirm={() => { if (pendingDelete) void deleteCase(pendingDelete); }}
    />
  </section>;
}
