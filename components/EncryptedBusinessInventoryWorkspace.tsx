"use client";

import { useEffect, useMemo, useState } from "react";

import { BusinessInventory } from "@/components/BusinessInventory";
import { useBusinessVault } from "@/components/BusinessVaultProvider";
import { loadBusinessInventorySource, type BusinessInventorySource } from "@/lib/e2ee/businessInventorySource";
import { createClient } from "@/lib/supabase/client";
import type { Business } from "@/lib/business/types";

export function EncryptedBusinessInventoryWorkspace({ business }: { business: Business }) {
  const client = useMemo(() => createClient(), []);
  const { status, businessKey, error: vaultError } = useBusinessVault();
  const [source, setSource] = useState<BusinessInventorySource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    setError("");

    if (status !== "unlocked" || !businessKey) {
      setLoading(status === "loading");
      return;
    }

    setLoading(true);
    void loadBusinessInventorySource(client, business.id)
      .then((loaded) => {
        if (!cancelled) setSource(loaded);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Encrypted Inventory could not be opened.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [business.id, businessKey, client, status]);

  if (status === "locked") {
    return <div className="panel"><div className="alert">Unlock your Financial Vault to open encrypted Business Inventory.</div></div>;
  }
  if (status === "unavailable") {
    return <div className="panel"><div className="alert">This Business Vault has not been shared with your account yet.</div></div>;
  }
  if (status === "error") {
    return <div className="panel"><div className="alert">{vaultError || "Business Vault could not be opened."}</div></div>;
  }
  if (loading || status === "loading") {
    return <div className="panel"><div className="alert">Opening encrypted Business Inventory…</div></div>;
  }
  if (error || !source) {
    return <div className="panel"><div className="alert">{error || "Business Inventory is unavailable."}</div></div>;
  }

  return (
    <BusinessInventory
      key={business.id}
      business={business}
      initialItems={source.items}
      initialMovements={source.movements}
      initialCategories={source.categories}
      initialLocations={source.locations}
      initialSuppliers={source.suppliers}
      initialCostCategories={source.costCategories}
      initialCostCentres={source.costCentres}
    />
  );
}
