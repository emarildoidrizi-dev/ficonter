"use client";

import { useEffect, useMemo, useState } from "react";
import { BusinessAdministration } from "@/components/BusinessAdministration";
import { useBusinessVault } from "@/components/BusinessVaultProvider";
import { installBusinessAdministrationBoundary } from "@/lib/e2ee/businessAdministrationBoundary";
import { decryptBusinessPayload, type BusinessCiphertextEnvelopeV1 } from "@/lib/e2ee/businessVault";
import { createClient } from "@/lib/supabase/client";
import type { Business } from "@/lib/business/types";

const DEFAULT_SETTINGS = {
  default_timezone: "UTC",
  date_format: "DD/MM/YYYY",
  number_format: "de-DE",
  default_payment_method: "Card",
  default_payment_terms_days: 14,
  default_sales_tax_rate: 0,
  invoice_prefix: "INV",
  next_invoice_number: 1,
  default_low_stock_threshold: 0,
};

export function EncryptedBusinessAdministrationWorkspace({
  userId,
  role,
  business: serverBusiness,
}: {
  userId: string;
  role: string;
  business: Business;
}) {
  const client = useMemo(() => createClient(), []);
  const { status, businessKey, error: vaultError } = useBusinessVault();
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (status !== "unlocked" || !businessKey) {
      setLoading(status === "loading");
      return;
    }
    installBusinessAdministrationBoundary(client, businessKey, serverBusiness.id);
    setLoading(true);
    setError("");
    void (async () => {
      const [businessResult, settingsResult, auditResult, documentsResult, ...countResults] = await Promise.all([
        client.from("businesses").select("*").eq("id", serverBusiness.id).single(),
        client.from("business_settings").select("*").eq("business_id", serverBusiness.id).maybeSingle(),
        client.from("business_audit_log").select("*").eq("business_id", serverBusiness.id).order("occurred_at", { ascending: false }).limit(100),
        client.from("business_documents").select("*").eq("business_id", serverBusiness.id).order("created_at", { ascending: false }),
        client.from("business_transactions").select("id", { count: "exact", head: true }).eq("business_id", serverBusiness.id),
        client.from("business_suppliers").select("id", { count: "exact", head: true }).eq("business_id", serverBusiness.id),
        client.from("business_supplier_invoices").select("id", { count: "exact", head: true }).eq("business_id", serverBusiness.id),
        client.from("business_inventory_items").select("id", { count: "exact", head: true }).eq("business_id", serverBusiness.id),
        client.from("business_inventory_movements").select("id", { count: "exact", head: true }).eq("business_id", serverBusiness.id),
        client.from("business_sales").select("id", { count: "exact", head: true }).eq("business_id", serverBusiness.id),
        client.from("business_cost_categories").select("id", { count: "exact", head: true }).eq("business_id", serverBusiness.id),
        client.from("business_cost_centres").select("id", { count: "exact", head: true }).eq("business_id", serverBusiness.id),
      ]);
      const firstError = businessResult.error ?? settingsResult.error ?? auditResult.error ?? documentsResult.error ?? countResults.find((x:any)=>x.error)?.error;
      if (firstError) throw firstError;
      let business: any = businessResult.data ?? serverBusiness;
      if (business.encryption_version === 1 && business.encrypted_payload) {
        business = {
          ...business,
          ...(await decryptBusinessPayload(businessKey, serverBusiness.id, "business-profile", serverBusiness.id, business.encrypted_payload as BusinessCiphertextEnvelopeV1)),
        };
      }
      let settings: any = settingsResult.data;
      if (settings?.encryption_version === 1 && settings.encrypted_payload) {
        settings = {
          ...settings,
          ...(await decryptBusinessPayload(businessKey, serverBusiness.id, "business-settings", serverBusiness.id, settings.encrypted_payload as BusinessCiphertextEnvelopeV1)),
        };
      }
      settings = {
        business_id: serverBusiness.id,
        ...DEFAULT_SETTINGS,
        created_at: settings?.created_at ?? new Date().toISOString(),
        updated_at: settings?.updated_at ?? new Date().toISOString(),
        ...(settings ?? {}),
      };
      if (cancelled) return;
      setPayload({
        business,
        settings,
        audit: auditResult.data ?? [],
        documents: documentsResult.data ?? [],
        counts: {
          transactions: countResults[0].count ?? 0,
          suppliers: countResults[1].count ?? 0,
          supplierInvoices: countResults[2].count ?? 0,
          inventoryItems: countResults[3].count ?? 0,
          inventoryMovements: countResults[4].count ?? 0,
          sales: countResults[5].count ?? 0,
          costCategories: countResults[6].count ?? 0,
          costCentres: countResults[7].count ?? 0,
        },
      });
      setLoading(false);
    })().catch((caught) => {
      if (cancelled) return;
      setError(caught instanceof Error ? caught.message : "Business Administration could not be opened.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [businessKey, client, serverBusiness, status]);

  if (status === "locked") return <div className="panel"><div className="alert">Unlock your Financial Vault to open encrypted Business Administration.</div></div>;
  if (status === "unavailable") return <div className="panel"><div className="alert">This Business Vault has not been shared with your account yet.</div></div>;
  if (status === "error") return <div className="panel"><div className="alert">{vaultError || "Business Vault could not be opened."}</div></div>;
  if (loading || status === "loading") return <div className="panel"><div className="alert">Opening encrypted Business Administration…</div></div>;
  if (error || !payload) return <div className="panel"><div className="alert">{error || "Business Administration is unavailable."}</div></div>;

  return (
    <BusinessAdministration
      key={serverBusiness.id}
      userId={userId}
      role={role}
      initialBusiness={payload.business}
      initialSettings={payload.settings}
      initialAudit={payload.audit}
      initialDocuments={payload.documents}
      counts={payload.counts}
    />
  );
}
