"use client";

import Link from "next/link";
import { ArrowUpRight, Link2, ReceiptText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEncryptedBills } from "@/components/EncryptedBillProvider";
import { useEncryptedTransactions } from "@/components/EncryptedTransactionProvider";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/financialOptions";
import styles from "./BillsLinkedRecords.module.css";

type BillPaymentRun = {
  source_id: string;
  transaction_id: string | null;
  scheduled_for: string;
  trigger_mode: string;
  status: string;
};

type LinkedRecord = {
  transactionId: string;
  description: string;
  amount: number;
  currency: string;
  occurredAt: string;
  relationship: string;
};

const recordDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function readableDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return recordDateFormatter.format(date);
}

export function BillsLinkedRecords({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { bills, loading: billsLoading } = useEncryptedBills();
  const { transactions, loading: transactionsLoading } = useEncryptedTransactions();
  const [runs, setRuns] = useState<BillPaymentRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshRuns = useCallback(async () => {
    setRunsLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("automatic_payment_runs")
        .select("source_id,transaction_id,scheduled_for,trigger_mode,status")
        .eq("user_id", userId)
        .eq("source_type", "bill")
        .not("transaction_id", "is", null)
        .order("scheduled_for", { ascending: false });

      if (queryError) throw queryError;
      setRuns((data ?? []) as BillPaymentRun[]);
    } catch (caughtError) {
      setRuns([]);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Linked Bill transactions could not be loaded.",
      );
    } finally {
      setRunsLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void refreshRuns();

    const channel = supabase
      .channel(`bill-linked-records-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "automatic_payment_runs",
          filter: `user_id=eq.${userId}`,
        },
        () => void refreshRuns(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshRuns, supabase, userId]);

  const linkedByBill = useMemo(() => {
    const transactionById = new Map(
      transactions.map((transaction) => [transaction.id, transaction]),
    );
    const runsByBill = new Map<string, BillPaymentRun[]>();

    for (const run of runs) {
      const current = runsByBill.get(run.source_id) ?? [];
      current.push(run);
      runsByBill.set(run.source_id, current);
    }

    const result = new Map<string, LinkedRecord[]>();

    for (const bill of bills) {
      const records = new Map<string, LinkedRecord>();

      for (const run of runsByBill.get(bill.id) ?? []) {
        if (!run.transaction_id) continue;
        const transaction = transactionById.get(run.transaction_id);
        if (!transaction) continue;

        records.set(transaction.id, {
          transactionId: transaction.id,
          description: transaction.description,
          amount: Number(transaction.amount),
          currency: transaction.currency,
          occurredAt:
            transaction.occurred_at ??
            run.scheduled_for ??
            `${transaction.transaction_date}T12:00:00`,
          relationship:
            run.trigger_mode === "automatic"
              ? "Automatic Bill transaction"
              : "Bill transaction",
        });
      }

      if (bill.transaction_id && !records.has(bill.transaction_id)) {
        const transaction = transactionById.get(bill.transaction_id);
        if (transaction) {
          records.set(transaction.id, {
            transactionId: transaction.id,
            description: transaction.description,
            amount: Number(transaction.amount),
            currency: transaction.currency,
            occurredAt:
              transaction.occurred_at ??
              `${transaction.transaction_date}T12:00:00`,
            relationship: "Direct Bill transaction",
          });
        }
      }

      result.set(
        bill.id,
        [...records.values()].sort(
          (a, b) =>
            new Date(b.occurredAt).getTime() -
            new Date(a.occurredAt).getTime(),
        ),
      );
    }

    return result;
  }, [bills, runs, transactions]);

  const loading = billsLoading || transactionsLoading || runsLoading;

  return (
    <section className={styles.panel} aria-labelledby="bill-linked-records-title">
      <div className={styles.heading}>
        <div className={styles.headingIcon}>
          <Link2 size={20} />
        </div>
        <div>
          <h2 id="bill-linked-records-title">Linked records</h2>
          <p>
            Every Bill is connected to the real Transaction records generated
            from that obligation.
          </p>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {loading ? (
        <div className={styles.state}>Resolving encrypted Bill relationships…</div>
      ) : bills.length === 0 ? (
        <div className={styles.state}>No Bills are available yet.</div>
      ) : (
        <div className={styles.groups}>
          {bills.map((bill) => {
            const records = linkedByBill.get(bill.id) ?? [];
            return (
              <article className={styles.group} key={bill.id}>
                <div className={styles.billHeader}>
                  <div className={styles.billIdentity}>
                    <ReceiptText size={18} />
                    <div>
                      <strong>{bill.name}</strong>
                      <span>
                        {bill.company || "No company"} · {bill.category}
                      </span>
                    </div>
                  </div>
                  <span className={styles.count}>
                    {records.length} linked {records.length === 1 ? "transaction" : "transactions"}
                  </span>
                </div>

                {records.length ? (
                  <div className={styles.records}>
                    {records.map((record) => (
                      <Link
                        key={record.transactionId}
                        href={`/dashboard/transactions/${record.transactionId}`}
                        className={styles.record}
                      >
                        <div className={styles.recordCopy}>
                          <span>{record.relationship}</span>
                          <strong>{record.description}</strong>
                          <small>{readableDate(record.occurredAt)}</small>
                        </div>
                        <div className={styles.recordValue}>
                          <strong>-{formatCurrency(record.amount, record.currency)}</strong>
                          <ArrowUpRight size={18} aria-hidden="true" />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyRecord}>
                    No transaction has been recorded from this Bill yet.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
