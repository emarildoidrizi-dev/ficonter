"use client";

import { useEffect, useMemo, useState } from "react";

import { BusinessOverview } from "@/components/BusinessOverview";
import { useBusinessVault } from "@/components/BusinessVaultProvider";
import { loadBusinessInventorySource } from "@/lib/e2ee/businessInventorySource";
import { createClient } from "@/lib/supabase/client";
import type {
  Business,
  BusinessCostBudget,
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessSale,
  BusinessTransaction,
} from "@/lib/business/types";

type Loaded = {
  transactions: BusinessTransaction[];
  budgets: BusinessCostBudget[];
  categories: BusinessCostCategory[];
  centres: BusinessCostCentre[];
  sales: BusinessSale[];
};

export function EncryptedBusinessOverviewWorkspace({ business }: { business: Business }) {
  const client = useMemo(() => createClient(), []);
  const { status, businessKey, error: vaultError } = useBusinessVault();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setInventory([]);
    setError("");

    if (status !== "unlocked" || !businessKey) {
      setLoading(status === "loading");
      return;
    }

    setLoading(true);
    void Promise.all([
      client.from("business_transactions").select("*").eq("business_id", business.id),
      client.from("business_cost_budgets").select("*").eq("business_id", business.id),
      client.from("business_cost_categories").select("*").eq("business_id", business.id),
      client.from("business_cost_centres").select("*").eq("business_id", business.id),
      client.from("business_sales").select("*").eq("business_id", business.id),
      loadBusinessInventorySource(client, business.id),
    ])
      .then(([transactionsResult, budgetsResult, categoriesResult, centresResult, salesResult, inventorySource]) => {
        const firstError =
          transactionsResult.error ?? budgetsResult.error ?? categoriesResult.error ??
          centresResult.error ?? salesResult.error;
        if (firstError) throw firstError;
        if (cancelled) return;

        setLoaded({
          transactions: ((transactionsResult.data ?? []) as BusinessTransaction[])
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
          budgets: (budgetsResult.data ?? []) as BusinessCostBudget[],
          categories: ((categoriesResult.data ?? []) as BusinessCostCategory[])
            .sort((a, b) => a.name.localeCompare(b.name)),
          centres: ((centresResult.data ?? []) as BusinessCostCentre[])
            .sort((a, b) => a.name.localeCompare(b.name)),
          sales: ((salesResult.data ?? []) as BusinessSale[])
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
        });
        setInventory(inventorySource.items);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Encrypted Business Overview could not be opened.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [business.id, businessKey, client, status]);

  if (status === "locked") return <div className="panel"><div className="alert">Unlock your Financial Vault to open encrypted Business Overview.</div></div>;
  if (status === "unavailable") return <div className="panel"><div className="alert">This Business Vault has not been shared with your account yet.</div></div>;
  if (status === "error") return <div className="panel"><div className="alert">{vaultError || "Business Vault could not be opened."}</div></div>;
  if (loading || status === "loading") return <div className="panel"><div className="alert">Opening encrypted Business Overview…</div></div>;
  if (error || !loaded) return <div className="panel"><div className="alert">{error || "Business Overview is unavailable."}</div></div>;

  return (
    <BusinessOverview
      key={business.id}
      business={business}
      initialTransactions={loaded.transactions}
      initialBudgets={loaded.budgets}
      initialCategories={loaded.categories}
      initialCentres={loaded.centres}
      initialInventory={inventory}
      initialSales={loaded.sales}
    />
  );
}
