"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GoalsManager } from "@/components/GoalsManager";
import { useVault } from "@/components/VaultProvider";
import { createClient } from "@/lib/supabase/client";
import { decryptGoalPayload } from "@/lib/e2ee/goalPayload";
import { decryptGoalInvestmentPayload } from "@/lib/e2ee/goalInvestmentPayload";
import { migrateLegacyPlaintextGoals } from "@/lib/e2ee/goalMigration";
import { subscribeFiconterDataChanges } from "@/lib/ficonterRealtime";

export function EncryptedGoalsWorkspace({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();
  const [goals, setGoals] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const runningRef = useRef(false);
  const queuedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (vaultStatus !== "unlocked" || !vaultKey) {
      setGoals([]);
      setInvestments([]);
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
        await migrateLegacyPlaintextGoals(supabase, vaultKey, userId);

        const [goalsResult, investmentsResult] = await Promise.all([
          (supabase.from("goals") as any)
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: true }),
          (supabase.from("goal_investments") as any)
            .select("*")
            .eq("user_id", userId)
            .order("invested_at", { ascending: false }),
        ]);
        if (goalsResult.error) throw goalsResult.error;
        if (investmentsResult.error) throw investmentsResult.error;

        const openedGoals = await Promise.all(
          ((goalsResult.data ?? []) as any[]).map(async (row) =>
            row.encryption_version === 1 && row.encrypted_payload
              ? { ...row, ...(await decryptGoalPayload(vaultKey, userId, row)) }
              : row,
          ),
        );
        const openedInvestments = await Promise.all(
          ((investmentsResult.data ?? []) as any[]).map(async (row) =>
            row.encryption_version === 1 && row.encrypted_payload
              ? { ...row, ...(await decryptGoalInvestmentPayload(vaultKey, userId, row)) }
              : row,
          ),
        );

        setGoals(openedGoals);
        setInvestments(openedInvestments);
      } while (queuedRef.current);
    } catch (caughtError) {
      setGoals([]);
      setInvestments([]);
      setError(caughtError instanceof Error ? caughtError.message : "Goals could not be opened.");
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, [supabase, userId, vaultKey, vaultStatus]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (vaultStatus !== "unlocked") return;
    let active = true;
    const channels = ["goals", "goal_investments"].map((table) =>
      supabase
        .channel(`e2ee-goals-${table}-${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` }, () => {
          if (active) void refresh();
        })
        .subscribe(),
    );
    const unsubscribe = subscribeFiconterDataChanges((change) => {
      if (change.scope === "all") void refresh();
    });
    return () => {
      active = false;
      unsubscribe();
      channels.forEach((channel) => void supabase.removeChannel(channel));
    };
  }, [refresh, supabase, userId, vaultStatus]);

  if (vaultStatus !== "unlocked") {
    return <div className="panel"><div className="alert">Unlock your Financial Vault to open Goals.</div></div>;
  }

  if (loading) {
    return <div className="panel"><div className="muted">Opening Goals…</div></div>;
  }

  return (
    <GoalsManager
      key={`${goals.length}:${investments.length}:${goals.map((goal) => goal.e2ee_revision ?? 0).join(",")}`}
      userId={userId}
      initialGoals={goals}
      initialInvestments={investments}
      initialError={error}
    />
  );
}
