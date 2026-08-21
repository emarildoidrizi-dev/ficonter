"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DebtManager } from "@/components/DebtManager";
import { useVault } from "@/components/VaultProvider";
import { createClient } from "@/lib/supabase/client";
import {
  decryptDebtPayload,
  type EncryptedDebtRow,
} from "@/lib/e2ee/debtPayload";
import {
  decryptDebtPaymentPayload,
  type EncryptedDebtPaymentRow,
} from "@/lib/e2ee/debtPaymentPayload";
import { migrateLegacyPlaintextDebtData } from "@/lib/e2ee/debtMigration";
import { subscribeFiconterDataChanges } from "@/lib/ficonterRealtime";

type DebtOperationalRow = EncryptedDebtRow & {
  e2ee_revision: number;
  payment_due_day: number | null;
  autopay: boolean;
  autopay_record_time: string;
  autopay_timezone: string;
  autopay_enabled_at: string | null;
  start_date: string | null;
  maturity_date: string | null;
  status: "active" | "paid_off" | "paused";
  created_at: string;
  updated_at: string;
};

type DebtPaymentOperationalRow = EncryptedDebtPaymentRow & {
  debt_id: string;
  paid_at: string;
  transaction_id: string | null;
  created_at: string;
};

type DecryptedDebt = DebtOperationalRow &
  Awaited<ReturnType<typeof decryptDebtPayload>>;

type DecryptedPayment = DebtPaymentOperationalRow &
  Awaited<ReturnType<typeof decryptDebtPaymentPayload>>;

export function EncryptedDebtWorkspace({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();
  const [debts, setDebts] = useState<DecryptedDebt[]>([]);
  const [payments, setPayments] = useState<DecryptedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refreshRunningRef = useRef(false);
  const refreshQueuedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (vaultStatus !== "unlocked" || !vaultKey) {
      setDebts([]);
      setPayments([]);
      setLoading(false);
      setError("");
      return;
    }

    if (refreshRunningRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    refreshRunningRef.current = true;
    setLoading(true);
    setError("");

    try {
      do {
        refreshQueuedRef.current = false;

        await migrateLegacyPlaintextDebtData(supabase, vaultKey, userId);

        const [debtsResult, paymentsResult] = await Promise.all([
          (supabase.from("debts") as any)
            .select(
              "id,user_id,encrypted_payload,encryption_version,e2ee_revision,payment_due_day,autopay,autopay_record_time,autopay_timezone,autopay_enabled_at,start_date,maturity_date,status,created_at,updated_at",
            )
            .eq("user_id", userId)
            .eq("encryption_version", 1)
            .not("encrypted_payload", "is", null)
            .order("created_at", { ascending: false }),
          (supabase.from("debt_payments") as any)
            .select(
              "id,debt_id,user_id,encrypted_payload,encryption_version,paid_at,transaction_id,created_at",
            )
            .eq("user_id", userId)
            .eq("encryption_version", 1)
            .not("encrypted_payload", "is", null)
            .order("paid_at", { ascending: false }),
        ]);

        if (debtsResult.error) throw debtsResult.error;
        if (paymentsResult.error) throw paymentsResult.error;

        const decryptedDebts = await Promise.all(
          ((debtsResult.data ?? []) as DebtOperationalRow[]).map(async (row) => ({
            ...row,
            ...(await decryptDebtPayload(vaultKey, userId, row)),
          })),
        );

        const decryptedPayments = await Promise.all(
          ((paymentsResult.data ?? []) as DebtPaymentOperationalRow[]).map(async (row) => ({
            ...row,
            ...(await decryptDebtPaymentPayload(vaultKey, userId, row)),
          })),
        );

        setDebts(decryptedDebts);
        setPayments(decryptedPayments);
      } while (refreshQueuedRef.current);
    } catch (caughtError) {
      setDebts([]);
      setPayments([]);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Encrypted Debt data could not be opened.",
      );
    } finally {
      refreshRunningRef.current = false;
      setLoading(false);
    }
  }, [supabase, userId, vaultKey, vaultStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (vaultStatus !== "unlocked") return;

    let active = true;
    const channels = ["debts", "debt_payments"].map((table) =>
      supabase
        .channel(`e2ee-debt-workspace-${table}-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `user_id=eq.${userId}`,
          },
          () => {
            if (active) void refresh();
          },
        )
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
    return (
      <div className="panel">
        <div className="alert">Unlock your Financial Vault to open Debt.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel">
        <div className="muted">Opening encrypted Debt data…</div>
      </div>
    );
  }

  return (
    <DebtManager
      key={`${debts.length}:${payments.length}:${debts.map((debt) => debt.e2ee_revision).join(",")}`}
      userId={userId}
      initialDebts={debts as any}
      initialPayments={payments as any}
      initialError={error}
    />
  );
}
