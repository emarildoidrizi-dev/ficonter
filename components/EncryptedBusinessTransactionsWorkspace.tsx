"use client";

import { useEffect, useMemo, useState } from "react";

import { BusinessTransactionLedger } from "@/components/BusinessTransactionLedger";
import { useBusinessVault } from "@/components/BusinessVaultProvider";
import { installBusinessE2eeBoundary } from "@/lib/e2ee/businessClientBoundary";
import { createClient } from "@/lib/supabase/client";
import type {
  Business,
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessSupplier,
  BusinessTransaction,
} from "@/lib/business/types";

export function EncryptedBusinessTransactionsWorkspace({
  userId,
  business,
  initialAdd = false,
}: {
  userId: string;
  business: Business;
  initialAdd?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { status, businessKey, error: vaultError } = useBusinessVault();
  const [transactions, setTransactions] = useState<BusinessTransaction[]>([]);
  const [categories, setCategories] = useState<BusinessCostCategory[]>([]);
  const [costCentres, setCostCentres] = useState<BusinessCostCentre[]>([]);
  const [suppliers, setSuppliers] = useState<BusinessSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  if (status === "unlocked" && businessKey) {
    installBusinessE2eeBoundary(supabase, businessKey, business.id);
  }

  useEffect(() => {
    let cancelled = false;
    if (status !== "unlocked" || !businessKey) {
      setLoading(status === "loading");
      return;
    }

    setLoading(true);
    setError("");
    void (async () => {
      const [transactionsResult, categoriesResult, centresResult, suppliersResult] = await Promise.all([
        supabase
          .from("business_transactions")
          .select("*")
          .eq("business_id", business.id)
          .order("occurred_at", { ascending: false })
          .limit(2500),
        supabase
          .from("business_cost_categories")
          .select("*")
          .eq("business_id", business.id),
        supabase
          .from("business_cost_centres")
          .select("*")
          .eq("business_id", business.id),
        supabase
          .from("business_suppliers")
          .select("*")
          .eq("business_id", business.id),
      ]);

      const firstError =
        transactionsResult.error ??
        categoriesResult.error ??
        centresResult.error ??
        suppliersResult.error;
      if (firstError) throw firstError;
      if (cancelled) return;

      setTransactions(((transactionsResult.data ?? []) as BusinessTransaction[]).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)));
      setCategories(((categoriesResult.data ?? []) as BusinessCostCategory[]).sort((a, b) => a.name.localeCompare(b.name)));
      setCostCentres(((centresResult.data ?? []) as BusinessCostCentre[]).sort((a, b) => a.name.localeCompare(b.name)));
      setSuppliers(((suppliersResult.data ?? []) as BusinessSupplier[]).sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    })().catch((caught) => {
      if (cancelled) return;
      setError(caught instanceof Error ? caught.message : "Business data could not be opened.");
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [business.id, businessKey, status, supabase]);

  if (status === "locked") {
    return <div className="panel"><div className="alert">Unlock your Financial Vault to open encrypted Business data.</div></div>;
  }
  if (status === "unavailable") {
    return <div className="panel"><div className="alert">This Business Vault has not been shared with your account yet.</div></div>;
  }
  if (status === "error") {
    return <div className="panel"><div className="alert">{vaultError || "Business Vault could not be opened."}</div></div>;
  }
  if (loading || status === "loading") {
    return <div className="panel"><div className="alert">Opening encrypted Business data…</div></div>;
  }
  if (error) {
    return <div className="panel"><div className="alert">{error}</div></div>;
  }

  return (
    <BusinessTransactionLedger
      key={business.id}
      userId={userId}
      business={business}
      initialTransactions={transactions}
      initialCategories={categories}
      initialCostCentres={costCentres}
      initialSuppliers={suppliers}
      initialAdd={initialAdd}
    />
  );
}
