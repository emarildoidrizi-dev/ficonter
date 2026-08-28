"use client";

import { useEffect, useMemo, useState } from "react";

import { BusinessSuppliers } from "@/components/BusinessSuppliers";
import { useBusinessVault } from "@/components/BusinessVaultProvider";
import { createClient } from "@/lib/supabase/client";
import type {
  Business,
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessSupplier,
  BusinessSupplierInvoice,
  BusinessTransaction,
} from "@/lib/business/types";

export function EncryptedBusinessSuppliersWorkspace({
  userId,
  business,
}: {
  userId: string;
  business: Business;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { status, error: vaultError } = useBusinessVault();
  const [suppliers, setSuppliers] = useState<BusinessSupplier[]>([]);
  const [invoices, setInvoices] = useState<BusinessSupplierInvoice[]>([]);
  const [transactions, setTransactions] = useState<BusinessTransaction[]>([]);
  const [categories, setCategories] = useState<BusinessCostCategory[]>([]);
  const [centres, setCentres] = useState<BusinessCostCentre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (status !== "unlocked") {
      setLoading(status === "loading");
      return;
    }

    setLoading(true);
    setError("");
    void (async () => {
      const [supplierResult, invoiceResult, transactionResult, categoryResult, centreResult] = await Promise.all([
        supabase.from("business_suppliers").select("*").eq("business_id", business.id),
        supabase.from("business_supplier_invoices").select("*").eq("business_id", business.id),
        supabase.from("business_transactions").select("*").eq("business_id", business.id).limit(5000),
        supabase.from("business_cost_categories").select("*").eq("business_id", business.id),
        supabase.from("business_cost_centres").select("*").eq("business_id", business.id),
      ]);

      const firstError =
        supplierResult.error ?? invoiceResult.error ?? transactionResult.error ??
        categoryResult.error ?? centreResult.error;
      if (firstError) throw firstError;
      if (cancelled) return;

      setSuppliers(((supplierResult.data ?? []) as BusinessSupplier[]).sort((a, b) => a.name.localeCompare(b.name)));
      setInvoices(((invoiceResult.data ?? []) as BusinessSupplierInvoice[]).sort((a, b) => b.due_date.localeCompare(a.due_date)));
      setTransactions(((transactionResult.data ?? []) as BusinessTransaction[])
        .filter((item) => item.type === "expense")
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)));
      setCategories(((categoryResult.data ?? []) as BusinessCostCategory[]).sort((a, b) => a.name.localeCompare(b.name)));
      setCentres(((centreResult.data ?? []) as BusinessCostCentre[]).sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    })().catch((caught) => {
      if (cancelled) return;
      setError(caught instanceof Error ? caught.message : "Business Suppliers could not be opened.");
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [business.id, status, supabase]);

  if (status === "locked") {
    return <div className="panel"><div className="alert">Unlock your Financial Vault to open encrypted Business Suppliers.</div></div>;
  }
  if (status === "unavailable") {
    return <div className="panel"><div className="alert">This Business Vault has not been shared with your account yet.</div></div>;
  }
  if (status === "error") {
    return <div className="panel"><div className="alert">{vaultError || "Business Vault could not be opened."}</div></div>;
  }
  if (loading || status === "loading") {
    return <div className="panel"><div className="alert">Opening encrypted Business Suppliers…</div></div>;
  }
  if (error) {
    return <div className="panel"><div className="alert">{error}</div></div>;
  }

  return (
    <BusinessSuppliers
      key={business.id}
      userId={userId}
      business={business}
      initialSuppliers={suppliers}
      initialInvoices={invoices}
      initialTransactions={transactions}
      initialCategories={categories}
      initialCentres={centres}
    />
  );
}
