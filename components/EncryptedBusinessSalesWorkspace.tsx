"use client";

import { useEffect, useMemo, useState } from "react";

import { BusinessSales } from "@/components/BusinessSales";
import { useBusinessVault } from "@/components/BusinessVaultProvider";
import { loadBusinessInventorySource } from "@/lib/e2ee/businessInventorySource";
import { createClient } from "@/lib/supabase/client";
import type { Business, BusinessInventoryItemSnapshot, BusinessSale } from "@/lib/business/types";

export function EncryptedBusinessSalesWorkspace({ business }: { business: Business }) {
  const client = useMemo(() => createClient(), []);
  const { status, businessKey, error: vaultError } = useBusinessVault();
  const [sales, setSales] = useState<BusinessSale[]>([]);
  const [inventory, setInventory] = useState<BusinessInventoryItemSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSales([]);
    setInventory([]);
    setError("");

    if (status !== "unlocked" || !businessKey) {
      setLoading(status === "loading");
      return;
    }

    setLoading(true);
    void Promise.all([
      client
        .from("business_sales")
        .select("*")
        .eq("business_id", business.id),
      loadBusinessInventorySource(client, business.id),
    ])
      .then(([salesResult, inventorySource]) => {
        if (salesResult.error) throw salesResult.error;
        if (cancelled) return;
        setSales(
          ((salesResult.data ?? []) as BusinessSale[])
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
        );
        setInventory(inventorySource.items);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Encrypted Sales could not be opened.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [business.id, businessKey, client, status]);

  if (status === "locked") {
    return <div className="panel"><div className="alert">Unlock your Financial Vault to open encrypted Business Sales.</div></div>;
  }
  if (status === "unavailable") {
    return <div className="panel"><div className="alert">This Business Vault has not been shared with your account yet.</div></div>;
  }
  if (status === "error") {
    return <div className="panel"><div className="alert">{vaultError || "Business Vault could not be opened."}</div></div>;
  }
  if (loading || status === "loading") {
    return <div className="panel"><div className="alert">Opening encrypted Business Sales…</div></div>;
  }
  if (error) {
    return <div className="panel"><div className="alert">{error}</div></div>;
  }

  return (
    <BusinessSales
      key={business.id}
      business={business}
      initialSales={sales}
      initialInventory={inventory}
    />
  );
}
