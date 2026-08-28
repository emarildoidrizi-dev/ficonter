"use client";

import { useEffect, useMemo, useRef } from "react";

import { useVault } from "@/components/VaultProvider";
import { migrateLegacyPlaintextDebtData } from "@/lib/e2ee/debtMigration";
import { migrateLegacyPlaintextCreditCardData } from "@/lib/e2ee/creditCardMigration";
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
      try {
        await migrateLegacyPlaintextDebtData(supabase, vaultKey, userId);
        await migrateLegacyPlaintextCreditCardData(supabase, vaultKey, userId);
        completedForSessionRef.current = true;
        notifyFiconterDataChange("all");
      } catch (error) {
        console.error("Vault legacy migration bootstrap failed", error);
      } finally {
        runningRef.current = false;
      }
    })();
  }, [status, supabase, userId, vaultKey]);

  return null;
}
