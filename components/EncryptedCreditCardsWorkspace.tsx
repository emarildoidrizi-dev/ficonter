"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CreditCardsManager } from "@/components/CreditCardsManager";
import { useVault } from "@/components/VaultProvider";
import { createClient } from "@/lib/supabase/client";
import { decryptCreditCardPayload } from "@/lib/e2ee/creditCardPayload";
import { decryptCreditCardActivityPayload } from "@/lib/e2ee/creditCardActivityPayload";
import { decryptCreditCardMonthlyRecordPayload } from "@/lib/e2ee/creditCardMonthlyRecordPayload";
import { decryptDebtPaymentPayload } from "@/lib/e2ee/debtPaymentPayload";
import { migrateLegacyPlaintextCreditCardData } from "@/lib/e2ee/creditCardMigration";
import { installCreditCardDebtBoundaryCompatibility } from "@/lib/e2ee/creditCardBoundaryCompatibility";
import { installCreditCardE2eeBoundary } from "@/lib/e2ee/creditCardClientBoundary";
import { subscribeFiconterDataChanges } from "@/lib/ficonterRealtime";

function monthKeyOf(value: unknown) {
  return typeof value === "string" ? value.slice(0, 7) : "";
}

function withPostedInterest(monthlyRows: any[], activities: any[]) {
  return monthlyRows.map((row) => {
    const month = monthKeyOf(row.month_start || row.statement_date);
    if (!month) return row;

    const interestActivities = activities.filter(
      (activity) =>
        activity.debt_id === row.debt_id &&
        activity.activity_type === "interest" &&
        monthKeyOf(activity.occurred_at) === month,
    );

    if (!interestActivities.length) return row;

    const interestCharged = interestActivities.reduce(
      (total, activity) => total + Number(activity.amount || 0),
      0,
    );
    const interestChargedEur = interestActivities.reduce(
      (total, activity) => total + Number(activity.amount_eur || 0),
      0,
    );

    return {
      ...row,
      interest_charged: Math.round((interestCharged + Number.EPSILON) * 100) / 100,
      interest_charged_eur: Math.round((interestChargedEur + Number.EPSILON) * 100) / 100,
    };
  });
}

export function EncryptedCreditCardsWorkspace({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();
  const [cards, setCards] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [monthlyRecords, setMonthlyRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const runningRef = useRef(false);
  const queuedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (vaultStatus !== "unlocked" || !vaultKey) {
      setCards([]);
      setActivities([]);
      setPayments([]);
      setMonthlyRecords([]);
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

        await migrateLegacyPlaintextCreditCardData(supabase, vaultKey, userId);
        installCreditCardDebtBoundaryCompatibility(supabase);
        installCreditCardE2eeBoundary(supabase, vaultKey, userId);

        const cardsResult = await (supabase.from("debts") as any)
          .select("*")
          .eq("user_id", userId)
          .eq("debt_kind", "credit_card")
          .order("created_at", { ascending: false });
        if (cardsResult.error) throw cardsResult.error;

        const rawCards = (cardsResult.data ?? []) as any[];
        const openedCards = await Promise.all(
          rawCards.map(async (row) => {
            if (row.encryption_version === 1 && row.encrypted_payload) {
              return {
                ...row,
                category: "Credit card",
                ...(await decryptCreditCardPayload(vaultKey, userId, row)),
              };
            }
            return row;
          }),
        );
        const cardIds = new Set(openedCards.map((card) => card.id));

        const [activitiesResult, paymentsResult, monthlyResult] = await Promise.all([
          (supabase.from("credit_card_activities") as any)
            .select("*")
            .eq("user_id", userId)
            .order("occurred_at", { ascending: false }),
          (supabase.from("debt_payments") as any)
            .select("*")
            .eq("user_id", userId)
            .order("paid_at", { ascending: false }),
          (supabase.from("credit_card_monthly_records") as any)
            .select("*")
            .eq("user_id", userId)
            .order("month_start", { ascending: false }),
        ]);

        if (activitiesResult.error) throw activitiesResult.error;
        if (paymentsResult.error) throw paymentsResult.error;
        if (monthlyResult.error) throw monthlyResult.error;

        const openedActivities = await Promise.all(
          ((activitiesResult.data ?? []) as any[])
            .filter((row) => cardIds.has(row.debt_id))
            .map(async (row) =>
              row.encryption_version === 1 && row.encrypted_payload
                ? { ...row, ...(await decryptCreditCardActivityPayload(vaultKey, userId, row)) }
                : row,
            ),
        );

        const openedPayments = await Promise.all(
          ((paymentsResult.data ?? []) as any[])
            .filter((row) => cardIds.has(row.debt_id))
            .map(async (row) =>
              row.encryption_version === 1 && row.encrypted_payload
                ? { ...row, ...(await decryptDebtPaymentPayload(vaultKey, userId, row)) }
                : row,
            ),
        );

        const openedMonthly = await Promise.all(
          ((monthlyResult.data ?? []) as any[])
            .filter((row) => cardIds.has(row.debt_id))
            .map(async (row) =>
              row.encryption_version === 1 && row.encrypted_payload
                ? { ...row, ...(await decryptCreditCardMonthlyRecordPayload(vaultKey, userId, row)) }
                : row,
            ),
        );

        setCards(openedCards);
        setActivities(openedActivities);
        setPayments(openedPayments);
        setMonthlyRecords(withPostedInterest(openedMonthly, openedActivities));
      } while (queuedRef.current);
    } catch (caughtError) {
      setCards([]);
      setActivities([]);
      setPayments([]);
      setMonthlyRecords([]);
      setError(caughtError instanceof Error ? caughtError.message : "Credit Card data could not be opened.");
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, [supabase, userId, vaultKey, vaultStatus]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (vaultStatus !== "unlocked") return;
    let active = true;
    const channels = ["debts", "credit_card_activities", "debt_payments", "credit_card_monthly_records"].map((table) =>
      supabase.channel(`e2ee-credit-cards-${table}-${userId}`)
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
    return <div className="panel"><div className="alert">Unlock your Financial Vault to open Credit Cards.</div></div>;
  }

  if (loading) {
    return <div className="panel"><div className="muted">Opening Credit Card data…</div></div>;
  }

  return (
    <CreditCardsManager
      key={`${cards.length}:${activities.length}:${payments.length}:${monthlyRecords.length}:${cards.map((card) => card.e2ee_revision ?? 0).join(",")}`}
      userId={userId}
      initialCards={cards}
      initialActivities={activities}
      initialPayments={payments}
      initialMonthlyRecords={monthlyRecords}
      initialError={error}
    />
  );
}
