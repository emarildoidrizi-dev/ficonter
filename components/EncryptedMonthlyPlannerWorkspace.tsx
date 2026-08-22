"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MonthlyPlanner } from "@/components/MonthlyPlanner";
import { useVault } from "@/components/VaultProvider";
import { createClient } from "@/lib/supabase/client";
import { migrateLegacyPlaintextMonthlyPlanner } from "@/lib/e2ee/monthlyPlannerMigration";
import { installMonthlyPlannerE2eeBoundary } from "@/lib/e2ee/monthlyPlannerClientBoundary";
import { subscribeFiconterDataChanges } from "@/lib/ficonterRealtime";

export function EncryptedMonthlyPlannerWorkspace({
  userId,
  showAdvancedPosition,
}: {
  userId: string;
  showAdvancedPosition: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();
  const [bills, setBills] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const runningRef = useRef(false);
  const queuedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (vaultStatus !== "unlocked" || !vaultKey) {
      setBills([]);
      setPlans([]);
      setItems([]);
      setGoals([]);
      setLoading(false);
      setError("");
      return;
    }

    if (runningRef.current) {
      queuedRef.current = true;
      return;
    }

    runningRef.current = true;
    setLoading(true);
    setError("");

    try {
      do {
        queuedRef.current = false;
        await migrateLegacyPlaintextMonthlyPlanner(supabase, vaultKey, userId);
        installMonthlyPlannerE2eeBoundary(supabase, vaultKey, userId);

        const [billResult, planResult, itemResult, goalResult] = await Promise.all([
          (supabase.from("bills") as any).select("*").eq("user_id", userId),
          (supabase.from("monthly_budget_plans") as any).select("*").eq("user_id", userId).order("month", { ascending: false }),
          (supabase.from("monthly_budget_items") as any).select("*").eq("user_id", userId).order("position", { ascending: true }),
          (supabase.from("goals") as any).select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        ]);
        const queryError = billResult.error ?? planResult.error ?? itemResult.error ?? goalResult.error;
        if (queryError) throw queryError;

        setBills(billResult.data ?? []);
        setPlans(planResult.data ?? []);
        setItems(itemResult.data ?? []);
        setGoals(goalResult.data ?? []);
      } while (queuedRef.current);
    } catch (caughtError) {
      setBills([]);
      setPlans([]);
      setItems([]);
      setGoals([]);
      setError(caughtError instanceof Error ? caughtError.message : "Monthly Planner data could not be opened.");
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, [supabase, userId, vaultKey, vaultStatus]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (vaultStatus !== "unlocked") return;
    let active = true;
    const tables = ["bills", "monthly_budget_plans", "monthly_budget_items", "goals"];
    const channels = tables.map((table) =>
      supabase.channel(`e2ee-planner-${table}-${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` }, () => {
          if (active) void refresh();
        })
        .subscribe(),
    );
    const unsubscribe = subscribeFiconterDataChanges((change) => {
      if (change.scope === "all" || change.scope === "planner" || change.scope === "bills") void refresh();
    });
    return () => {
      active = false;
      unsubscribe();
      channels.forEach((channel) => void supabase.removeChannel(channel));
    };
  }, [refresh, supabase, userId, vaultStatus]);

  if (vaultStatus !== "unlocked") {
    return <div className="panel"><div className="alert">Unlock your Financial Vault to open Monthly Planner.</div></div>;
  }

  if (loading) {
    return <div className="panel"><div className="muted">Opening Monthly Planner…</div></div>;
  }

  return (
    <MonthlyPlanner
      key={`${plans.length}:${items.length}:${goals.length}:${bills.length}:${plans.map((plan) => plan.e2ee_revision ?? 0).join(",")}`}
      userId={userId}
      initialTransactions={[]}
      initialBills={bills}
      initialPlans={plans}
      initialItems={items}
      initialGoals={goals}
      initialError={error}
      showAdvancedPosition={showAdvancedPosition}
    />
  );
}
