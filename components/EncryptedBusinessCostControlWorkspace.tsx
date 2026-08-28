"use client";

import { useEffect, useMemo, useState } from "react";

import { BusinessCostControl } from "@/components/BusinessCostControl";
import { useBusinessVault } from "@/components/BusinessVaultProvider";
import { installBusinessE2eeBoundary } from "@/lib/e2ee/businessClientBoundary";
import { createClient } from "@/lib/supabase/client";
import type {
  Business,
  BusinessCostBudget,
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessRecurringCost,
  BusinessSupplier,
  BusinessTransaction,
} from "@/lib/business/types";

export function EncryptedBusinessCostControlWorkspace({
  userId,
  business,
}: {
  userId: string;
  business: Business;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { status, businessKey, error: vaultError } = useBusinessVault();
  const [transactions, setTransactions] = useState<BusinessTransaction[]>([]);
  const [categories, setCategories] = useState<BusinessCostCategory[]>([]);
  const [centres, setCentres] = useState<BusinessCostCentre[]>([]);
  const [budgets, setBudgets] = useState<BusinessCostBudget[]>([]);
  const [recurringCosts, setRecurringCosts] = useState<BusinessRecurringCost[]>([]);
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
      const [txResult, categoryResult, centreResult, budgetResult, recurringResult, supplierResult] = await Promise.all([
        supabase.from("business_transactions").select("*").eq("business_id", business.id).limit(5000),
        supabase.from("business_cost_categories").select("*").eq("business_id", business.id),
        supabase.from("business_cost_centres").select("*").eq("business_id", business.id),
        supabase.from("business_cost_budgets").select("*").eq("business_id", business.id),
        supabase.from("business_recurring_costs").select("*").eq("business_id", business.id),
        supabase.from("business_suppliers").select("*").eq("business_id", business.id),
      ]);

      const firstError =
        txResult.error ?? categoryResult.error ?? centreResult.error ??
        budgetResult.error ?? recurringResult.error ?? supplierResult.error;
      if (firstError) throw firstError;
      if (cancelled) return;

      setTransactions(((txResult.data ?? []) as BusinessTransaction[]).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)));
      setCategories(((categoryResult.data ?? []) as BusinessCostCategory[]).sort((a, b) => a.name.localeCompare(b.name)));
      setCentres(((centreResult.data ?? []) as BusinessCostCentre[]).sort((a, b) => a.name.localeCompare(b.name)));
      setBudgets((budgetResult.data ?? []) as BusinessCostBudget[]);
      setRecurringCosts(((recurringResult.data ?? []) as BusinessRecurringCost[]).sort((a, b) => (a.next_run_at ?? "9999").localeCompare(b.next_run_at ?? "9999")));
      setSuppliers(((supplierResult.data ?? []) as BusinessSupplier[]).sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    })().catch((caught) => {
      if (cancelled) return;
      setError(caught instanceof Error ? caught.message : "Business Cost Control could not be opened.");
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [business.id, businessKey, status, supabase]);

  if (status === "locked") {
    return <div className="panel"><div className="alert">Unlock your Financial Vault to open encrypted Business Cost Control.</div></div>;
  }
  if (status === "unavailable") {
    return <div className="panel"><div className="alert">This Business Vault has not been shared with your account yet.</div></div>;
  }
  if (status === "error") {
    return <div className="panel"><div className="alert">{vaultError || "Business Vault could not be opened."}</div></div>;
  }
  if (loading || status === "loading") {
    return <div className="panel"><div className="alert">Opening encrypted Business Cost Control…</div></div>;
  }
  if (error) {
    return <div className="panel"><div className="alert">{error}</div></div>;
  }

  return (
    <BusinessCostControl
      key={business.id}
      userId={userId}
      business={business}
      initialTransactions={transactions}
      initialCategories={categories}
      initialCentres={centres}
      initialBudgets={budgets}
      initialRecurringCosts={recurringCosts}
      initialSuppliers={suppliers}
    />
  );
}
