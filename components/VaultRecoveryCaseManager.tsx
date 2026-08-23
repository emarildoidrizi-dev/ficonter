"use client";

import { useMemo, useState } from "react";
import { FileText, LoaderCircle, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import type { RecoveryCustomer, VaultRecoveryCase } from "@/lib/admin/vaultRecovery";

function fmt(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function VaultRecoveryCaseManager({ initialCustomers, initialCases }: { initialCustomers: RecoveryCustomer[]; initialCases: VaultRecoveryCase[] }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [cases, setCases] = useState(initialCases);
  const [customerId, setCustomerId] = useState(initialCustomers[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedCustomer = useMemo(() => customers.find((customer) => customer.id === customerId) ?? null, [customerId, customers]);

  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/vault-recovery", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not refresh recovery cases.");
      setCustomers(data.customers ?? []); setCases(data.cases ?? []);
      if (!customerId && data.customers?.[0]) setCustomerId(data.customers[0].id);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not refresh recovery cases."); }
    finally { setBusy(false); }
  }

  async function createCase() {
    if (!selectedCustomer || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/vault-recovery", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedCustomer.id, customerEmail: selectedCustomer.email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create recovery case.");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create recovery case."); setBusy(false); }
  }

  async function generateDocument(caseId: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/vault-recovery/${caseId}/document`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not generate consent document.");
      await refresh();
      window.open(data.documentUrl, "_blank", "noopener,noreferrer");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not generate consent document."); setBusy(false); }
  }

  return (
    <section style={{ padding: 28, maxWidth: 1200, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 24 }}>
        <div><span style={{ fontSize: 12, letterSpacing: ".12em", fontWeight: 700 }}>PRIVATE ADMINISTRATION</span><h1 style={{ fontSize: 32, margin: "6px 0" }}>Vault recovery cases</h1><p style={{ margin: 0, opacity: .72 }}>Create official recovery cases and generate customer-specific consent documents.</p></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(31,90,76,.2)", borderRadius: 999, padding: "8px 12px" }}><ShieldCheck size={16}/> Admin protected</div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, padding: 16, border: "1px solid rgba(120,120,120,.22)", borderRadius: 16, marginBottom: 22 }}>
        <label style={{ display: "grid", gap: 7 }}><strong>Customer account</strong><select value={customerId} onChange={(event) => setCustomerId(event.target.value)} style={{ minHeight: 42, borderRadius: 10, padding: "0 12px" }}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.email}</option>)}</select></label>
        <button type="button" disabled={!selectedCustomer || busy} onClick={() => void createCase()} style={{ alignSelf: "end", minHeight: 42, borderRadius: 10, padding: "0 16px", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>{busy ? <LoaderCircle size={16}/> : <Plus size={16}/>} Create recovery case</button>
      </div>

      {error ? <div role="alert" style={{ padding: 12, borderRadius: 10, marginBottom: 16, background: "rgba(180,50,50,.08)" }}>{error}</div> : null}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><h2 style={{ margin: 0, fontSize: 20 }}>Cases</h2><button type="button" onClick={() => void refresh()} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 11px", borderRadius: 9 }}><RefreshCw size={15}/> Refresh</button></div>
      <div style={{ display: "grid", gap: 12 }}>
        {cases.map((item) => {
          const latest = item.documents[0];
          return <article key={item.id} style={{ border: "1px solid rgba(120,120,120,.2)", borderRadius: 14, padding: 16, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 18 }}>
            <div><strong style={{ fontSize: 17 }}>{item.reference}</strong><div style={{ marginTop: 5 }}>{item.customerEmail}</div><small style={{ opacity: .68 }}>Opened {fmt(item.createdAt)} · Status: {item.status.replaceAll("_", " ")}</small>{latest ? <div style={{ marginTop: 8, fontSize: 13 }}><FileText size={14} style={{ verticalAlign: "-2px", marginRight: 5 }}/>{latest.documentId} · generated {fmt(latest.generatedAt)}</div> : null}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{latest ? <a href={`/dashboard/admin/support/vault-recovery/${item.id}/consent`} target="_blank" rel="noreferrer" style={{ padding: "9px 12px", border: "1px solid currentColor", borderRadius: 9, textDecoration: "none" }}>Open document</a> : null}<button type="button" onClick={() => void generateDocument(item.id)} disabled={busy} style={{ padding: "9px 12px", borderRadius: 9, fontWeight: 700 }}>{latest ? "Generate new document" : "Generate consent document"}</button></div>
          </article>;
        })}
        {!cases.length ? <div style={{ padding: 28, textAlign: "center", opacity: .68 }}>No Vault recovery cases yet.</div> : null}
      </div>
    </section>
  );
}
