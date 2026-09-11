"use client";

import Link from "next/link";
import { ArrowRight, Landmark, ReceiptText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEncryptedBills } from "@/components/EncryptedBillProvider";
import { useVault } from "@/components/VaultProvider";
import {
  decryptDebtPayload,
  type EncryptedDebtRow,
} from "@/lib/e2ee/debtPayload";
import {
  decryptDebtPaymentPayload,
  type EncryptedDebtPaymentRow,
} from "@/lib/e2ee/debtPaymentPayload";
import { formatCurrency } from "@/lib/financialOptions";
import styles from "./TransactionLinkedRecords.module.css";

type Props = {
  transactionId: string;
  userId: string;
};

type AutomaticBillRun = {
  source_id: string;
  scheduled_for: string;
  trigger_mode: string;
};

type DebtPaymentRow = EncryptedDebtPaymentRow & {
  debt_id: string;
  paid_at: string;
  transaction_id: string | null;
};

type DebtRow = EncryptedDebtRow & {
  status: "active" | "paid_off" | "paused";
};

type LinkedDebt = {
  id: string;
  name: string;
  lender: string | null;
  category: string;
  status: "active" | "paid_off" | "paused";
  currentBalance: number;
  currentBalanceCurrency: string;
  paymentAmount: number;
  paymentCurrency: string;
  paidAt: string;
};

export function TransactionLinkedRecords({ transactionId, userId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { bills } = useEncryptedBills();
  const { status: vaultStatus, vaultKey } = useVault();
  const [automaticBillRun, setAutomaticBillRun] = useState<AutomaticBillRun | null>(null);
  const [linkedDebt, setLinkedDebt] = useState<LinkedDebt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const directBill = useMemo(
    () => bills.find((bill) => bill.transaction_id === transactionId) ?? null,
    [bills, transactionId],
  );

  const automaticBill = useMemo(
    () => automaticBillRun
      ? bills.find((bill) => bill.id === automaticBillRun.source_id) ?? null
      : null,
    [automaticBillRun, bills],
  );

  const linkedBill = directBill ?? automaticBill;

  useEffect(() => {
    let active = true;

    async function resolveRelationships() {
      setLoading(true);
      setError("");
      setAutomaticBillRun(null);
      setLinkedDebt(null);

      try {
        const [billRunResult, debtPaymentResult] = await Promise.all([
          supabase
            .from("automatic_payment_runs")
            .select("source_id,scheduled_for,trigger_mode")
            .eq("user_id", userId)
            .eq("source_type", "bill")
            .eq("transaction_id", transactionId)
            .limit(1)
            .maybeSingle(),
          (supabase.from("debt_payments") as any)
            .select("id,debt_id,user_id,encrypted_payload,encryption_version,paid_at,transaction_id")
            .eq("user_id", userId)
            .eq("transaction_id", transactionId)
            .limit(1)
            .maybeSingle(),
        ]);

        if (billRunResult.error) throw billRunResult.error;
        if (debtPaymentResult.error) throw debtPaymentResult.error;

        if (active && billRunResult.data) {
          setAutomaticBillRun(billRunResult.data as AutomaticBillRun);
        }

        const paymentRow = debtPaymentResult.data as DebtPaymentRow | null;
        if (!paymentRow) return;
        if (vaultStatus !== "unlocked" || !vaultKey) {
          throw new Error("Unlock your Financial Vault to open the linked Debt record.");
        }

        const { data: debtData, error: debtError } = await (supabase.from("debts") as any)
          .select("id,user_id,encrypted_payload,encryption_version,status")
          .eq("user_id", userId)
          .eq("id", paymentRow.debt_id)
          .maybeSingle();

        if (debtError) throw debtError;
        const debtRow = debtData as DebtRow | null;
        if (!debtRow) return;

        const [paymentPayload, debtPayload] = await Promise.all([
          decryptDebtPaymentPayload(vaultKey, userId, paymentRow),
          decryptDebtPayload(vaultKey, userId, debtRow),
        ]);

        if (!active) return;
        setLinkedDebt({
          id: debtRow.id,
          name: debtPayload.name,
          lender: debtPayload.lender,
          category: debtPayload.category,
          status: debtRow.status,
          currentBalance: debtPayload.current_balance,
          currentBalanceCurrency: debtPayload.currency,
          paymentAmount: paymentPayload.amount,
          paymentCurrency: paymentPayload.currency,
          paidAt: paymentRow.paid_at,
        });
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Linked records could not be resolved.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void resolveRelationships();
    return () => {
      active = false;
    };
  }, [supabase, transactionId, userId, vaultKey, vaultStatus]);

  if (loading && !linkedBill && !linkedDebt) {
    return <p className={styles.message}>Resolving linked records…</p>;
  }

  return (
    <div className={styles.stack}>
      {linkedBill ? (
        <article className={styles.recordCard}>
          <div className={styles.icon}><ReceiptText size={18} /></div>
          <div className={styles.copy}>
            <span className={styles.moduleLabel}>BILLS</span>
            <strong>{linkedBill.name}</strong>
            <p>{linkedBill.company || "No company"} · {linkedBill.category}</p>
            <dl>
              <div><dt>Relationship</dt><dd>{directBill ? "Bill payment" : "Automatic bill schedule"}</dd></div>
              <div><dt>Status</dt><dd>{linkedBill.status}</dd></div>
              <div><dt>Current due date</dt><dd>{linkedBill.due_date}</dd></div>
            </dl>
          </div>
          <Link className={styles.openLink} href="/dashboard/bills">
            Open Bills <ArrowRight size={15} />
          </Link>
        </article>
      ) : null}

      {linkedDebt ? (
        <article className={styles.recordCard}>
          <div className={styles.icon}><Landmark size={18} /></div>
          <div className={styles.copy}>
            <span className={styles.moduleLabel}>DEBT</span>
            <strong>{linkedDebt.name}</strong>
            <p>{linkedDebt.lender || "No lender"} · {linkedDebt.category}</p>
            <dl>
              <div><dt>Relationship</dt><dd>Debt payment</dd></div>
              <div><dt>Payment</dt><dd>{formatCurrency(linkedDebt.paymentAmount, linkedDebt.paymentCurrency)}</dd></div>
              <div><dt>Outstanding</dt><dd>{formatCurrency(linkedDebt.currentBalance, linkedDebt.currentBalanceCurrency)}</dd></div>
              <div><dt>Status</dt><dd>{linkedDebt.status.replace("_", " ")}</dd></div>
            </dl>
          </div>
          <Link className={styles.openLink} href="/dashboard/debt">
            Open Debt <ArrowRight size={15} />
          </Link>
        </article>
      ) : null}

      {!linkedBill && !linkedDebt && !loading ? (
        <p className={styles.message}>No linked Bill or Debt record is attached to this transaction.</p>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
