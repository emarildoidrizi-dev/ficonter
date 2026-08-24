"use client";

import { useEffect, useMemo, useState } from "react";
import { FileCheck2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { VaultRecoveryCase } from "@/lib/admin/vaultRecovery";

type DeliveryDocument = VaultRecoveryCase["documents"][number] & {
  sentToCustomerAt?: string | null;
  customerSignedAt?: string | null;
};

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

const card: React.CSSProperties = {
  border: "1px solid rgba(120,120,120,.18)",
  borderRadius: 16,
  padding: 18,
  background: "rgba(255,255,255,.025)",
};

const button: React.CSSProperties = {
  minHeight: 38,
  padding: "0 13px",
  borderRadius: 10,
  border: "1px solid rgba(120,120,120,.24)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: "inherit",
  fontWeight: 650,
  fontSize: 13,
};

export function VaultRecoveryRecords({ cases: initialCases }: { cases: VaultRecoveryCase[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [cases, setCases] = useState(initialCases);

  useEffect(() => {
    let active = true;

    async function reload() {
      const response = await fetch("/api/admin/vault-recovery", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      if (active) setCases(data.cases ?? []);
    }

    const channel = supabase
      .channel("admin-vault-recovery-records")
      .on("postgres_changes", { event: "*", schema: "public", table: "vault_recovery_documents" }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "vault_recovery_requests" }, () => void reload())
      .subscribe();

    const fallback = window.setInterval(() => void reload(), 10000);
    window.addEventListener("focus", reload);

    return () => {
      active = false;
      window.clearInterval(fallback);
      window.removeEventListener("focus", reload);
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const records = cases.filter((item) => {
    const latest = item.documents[0] as DeliveryDocument | undefined;
    return Boolean(latest?.customerSignedAt);
  });

  return (
    <section style={{ padding: "0 clamp(16px,3vw,32px) 48px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
        <ShieldCheck size={18} />
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Recovery records ({records.length})</h2>
          <div style={{ marginTop: 3, fontSize: 12, opacity: .62 }}>Signed customer authorizations are recorded here automatically.</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {records.map((item) => {
          const latest = item.documents[0] as DeliveryDocument;
          return (
            <article key={item.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 750 }}><FileCheck2 size={16} />{item.reference}</div>
                  <div style={{ marginTop: 6, fontWeight: 650 }}>{item.customerName || "Name not provided"}</div>
                  <div style={{ marginTop: 2, fontSize: 13, opacity: .7 }}>{item.customerEmail}</div>
                </div>
                <span style={{ alignSelf: "flex-start", border: "1px solid rgba(120,120,120,.22)", borderRadius: 999, padding: "5px 9px", fontSize: 12 }}>Document Signed</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 14, fontSize: 13 }}>
                <div><strong>FICONTER User ID</strong><div style={{ opacity: .72, overflowWrap: "anywhere" }}>{item.userId}</div></div>
                <div><strong>Document ID</strong><div style={{ opacity: .72 }}>{latest.documentId}</div></div>
                <div><strong>Sent to customer</strong><div style={{ opacity: .72 }}>{latest.sentToCustomerAt ? fmt(latest.sentToCustomerAt) : "—"}</div></div>
                <div><strong>Signed & submitted</strong><div style={{ opacity: .72 }}>{fmt(latest.customerSignedAt!)}</div></div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                <a style={button} href={`/dashboard/admin/support/vault-recovery/${item.id}/signed`} target="_blank" rel="noreferrer">View signed document</a>
                <a style={button} href={`/dashboard/admin/support/vault-recovery/${item.id}/signed`} target="_blank" rel="noreferrer">Print / save PDF</a>
              </div>
            </article>
          );
        })}
        {!records.length ? <div style={{ ...card, textAlign: "center", opacity: .62 }}>No signed recovery records yet.</div> : null}
      </div>
    </section>
  );
}
