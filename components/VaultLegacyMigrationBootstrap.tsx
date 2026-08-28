"use client";

import { useEffect, useMemo, useRef } from "react";

import { useVault } from "@/components/VaultProvider";
import { migrateLegacyPlaintextDebtData } from "@/lib/e2ee/debtMigration";
import { migrateLegacyPlaintextCreditCardData } from "@/lib/e2ee/creditCardMigration";
import { migrateLegacyPlaintextGoals } from "@/lib/e2ee/goalMigration";
import { migrateLegacyPlaintextMonthlyPlanner } from "@/lib/e2ee/monthlyPlannerMigration";
import { notifyFiconterDataChange } from "@/lib/ficonterRealtime";
import { createClient } from "@/lib/supabase/client";

export function VaultLegacyMigrationBootstrap({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { status, vaultKey } = useVault();
  const runningRef = useRef(false);
  const completedForSessionRef = useRef(false);

  useEffect(() => {
    if (status !== "unlocked" || !vaultKey) {
      completedForSessionRef.current = false;
      return;
    }

    if (runningRef.current || completedForSessionRef.current) return;

    runningRef.current = true;

    void (async () => {
      const steps = [
        ["debt", () => migrateLegacyPlaintextDebtData(supabase, vaultKey, userId)],
        ["credit card", () => migrateLegacyPlaintextCreditCardData(supabase, vaultKey, userId)],
        ["goals", () => migrateLegacyPlaintextGoals(supabase, vaultKey, userId)],
        ["monthly planner", () => migrateLegacyPlaintextMonthlyPlanner(supabase, vaultKey, userId)],
      ] as const;

      let completedAny = false;

      try {
        for (const [name, run] of steps) {
          try {
            await run();
            completedAny = true;
          } catch (error) {
            console.warn(`Vault legacy ${name} migration encountered a recoverable error.`, error);
          }
        }

        completedForSessionRef.current = true;
        if (completedAny) notifyFiconterDataChange("all");
      } finally {
        runningRef.current = false;
      }
    })();
  }, [status, supabase, userId, vaultKey]);

  return null;
}
