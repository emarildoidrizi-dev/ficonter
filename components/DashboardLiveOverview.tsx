"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Euro,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/financialOptions";
import { FinancialHealthScore } from "@/components/FinancialHealthScore";
import styles from "./DashboardLiveOverview.module.css";

type Transaction = {
  id: string;
  user_id?: string;
  description: string;
  amount: number | string;
  currency: string | null;
  amount_eur: number | string | null;
  exchange_rate_to_eur?: number | string | null;
  exchange_rate_date?: string | null;
  type: string;
  category: string;
  transaction_date: string;
  occurred_at: string | null;
  created_at?: string | null;
};

type Props = {
  userId: string;
  name: string;
  initialTransactions: Transaction[];
  initialError?: string;
};

function euroValue(transaction: Transaction) {
  // amount_eur is the authoritative reporting value. Falling back to amount
  // only protects legacy EUR rows created before the conversion migration.
  if (transaction.amount_eur !== null && transaction.amount_eur !== undefined) {
    return Number(transaction.amount_eur);
  }
  return transaction.currency === "EUR" || !transaction.currency
    ? Number(transaction.amount)
    : 0;
}

function isIncome(transaction: Transaction) {
  return transaction.type === "income";
}

function readableDateTime(transaction: Transaction) {
  const value =
    transaction.occurred_at ??
    transaction.created_at ??
    `${transaction.transaction_date}T00:00:00`;
  const date = new Date(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

function newestFirst(a: Transaction, b: Transaction) {
  const aTime = new Date(
    a.occurred_at ?? a.created_at ?? `${a.transaction_date}T00:00:00`,
  ).getTime();
  const bTime = new Date(
    b.occurred_at ?? b.created_at ?? `${b.transaction_date}T00:00:00`,
  ).getTime();
  return bTime - aTime;
}

export function DashboardLiveOverview({
  userId,
  name,
  initialTransactions,
  initialError = "",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [transactions, setTransactions] = useState(
    [...initialTransactions].sort(newestFirst),
  );
  const [connectionState, setConnectionState] = useState<
    "connecting" | "live" | "offline"
  >("connecting");

  useEffect(() => {
    setTransactions([...initialTransactions].sort(newestFirst));
  }, [initialTransactions]);

  useEffect(() => {
    function upsert(event: Event) {
      const transaction = (event as CustomEvent<Transaction>).detail;
      if (!transaction?.id) return;
      setTransactions((current) => [
        transaction,
        ...current.filter((item) => item.id !== transaction.id),
      ].sort(newestFirst));
    }

    function remove(event: Event) {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!id) return;
      setTransactions((current) => current.filter((item) => item.id !== id));
    }

    window.addEventListener("ficonter:transaction-created", upsert);
    window.addEventListener("ficonter:transaction-upserted", upsert);
    window.addEventListener("ficonter:transaction-deleted", remove);
    window.addEventListener("ficonter:transaction-save-failed", remove);

    return () => {
      window.removeEventListener("ficonter:transaction-created", upsert);
      window.removeEventListener("ficonter:transaction-upserted", upsert);
      window.removeEventListener("ficonter:transaction-deleted", remove);
      window.removeEventListener("ficonter:transaction-save-failed", remove);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`dashboard-transactions-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setTransactions((current) => {
            if (payload.eventType === "DELETE") {
              const deletedId = (payload.old as { id?: string }).id;
              return current.filter((item) => item.id !== deletedId);
            }

            const next = payload.new as Transaction;
            if (!next?.id) return current;
            return [next, ...current.filter((item) => item.id !== next.id)].sort(
              newestFirst,
            );
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnectionState("live");
        else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        )
          setConnectionState("offline");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (summary, transaction) => {
        const value = euroValue(transaction);
        if (isIncome(transaction)) summary.income += value;
        else summary.expenses += value;
        return summary;
      },
      { income: 0, expenses: 0 },
    );
  }, [transactions]);

  const cashFlow = totals.income - totals.expenses;
  const savingsRate = totals.income
    ? Math.max(0, (cashFlow / totals.income) * 100)
    : 0;
  const recent = transactions;

  return (
    <>
      <header className="topbar">
        <div className="page-title">
          <h1>Good morning, {name}.</h1>
          <p>Your private financial overview, normalized in euros.</p>
        </div>
        <div className={styles.headerActions}>
          <div
            className={`${styles.livePill} ${
              connectionState === "live"
                ? styles.live
                : connectionState === "offline"
                  ? styles.offline
                  : styles.connecting
            }`}
          >
            <span />
            {connectionState === "live"
              ? "Live"
              : connectionState === "offline"
                ? "Reconnecting"
                : "Connecting"}
          </div>
          <Link className="btn btn-gold" href="/dashboard/transactions">
            Add transaction
          </Link>
        </div>
      </header>

      {initialError && <div className="alert alert-error">{initialError}</div>}

      <section className="kpis">
        <div className="kpi">
          <span>Income recorded</span>
          <strong>{formatCurrency(totals.income, "EUR")}</strong>
          <small className={styles.kpiNote}>All currencies converted to EUR</small>
        </div>
        <div className="kpi">
          <span>Expenses recorded</span>
          <strong>{formatCurrency(totals.expenses, "EUR")}</strong>
          <small className={styles.kpiNote}>All currencies converted to EUR</small>
        </div>
        <div className="kpi">
          <span>Cash flow</span>
          <strong
            className={cashFlow >= 0 ? "amount-positive" : "amount-negative"}
          >
            {formatCurrency(cashFlow, "EUR")}
          </strong>
          <small className={styles.kpiNote}>Income minus expenses in EUR</small>
        </div>
        <div className="kpi">
          <span>Savings rate</span>
          <strong>{savingsRate.toFixed(1)}%</strong>
          <small className={styles.kpiNote}>Based on EUR-normalized totals</small>
        </div>
      </section>

      <FinancialHealthScore transactions={transactions} />

      <section className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Live transaction table</h3>
              <p className="muted">Updates instantly when data changes.</p>
            </div>
            <Link href="/dashboard/transactions">View all</Link>
          </div>

          {recent.length ? (
            <>
            <div
              className={styles.liveTable}
              tabIndex={recent.length > 10 ? 0 : undefined}
              aria-label="Live transaction history. The newest ten transactions are visible first; scroll for older records."
            >
              {recent.map((transaction) => {
                const currency = transaction.currency || "EUR";
                const originalAmount = Number(transaction.amount);
                const converted = euroValue(transaction);
                const income = isIncome(transaction);
                const foreign = currency !== "EUR";

                return (
                  <article className={styles.transactionRow} key={transaction.id}>
                    <div
                      className={`${styles.flowIcon} ${
                        income ? styles.incomeIcon : styles.expenseIcon
                      }`}
                    >
                      {income ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>
                    <div className={styles.transactionMain}>
                      <strong>{transaction.description}</strong>
                      <span>{transaction.category}</span>
                      <small>
                        <Clock3 size={13} /> {readableDateTime(transaction)}
                      </small>
                    </div>
                    <div className={styles.transactionAmount}>
                      <strong className={income ? "amount-positive" : "amount-negative"}>
                        {income ? "+" : "-"}
                        {formatCurrency(converted, "EUR")}
                      </strong>
                      {foreign ? (
                        <span>
                          Original: {formatCurrency(originalAmount, currency)}
                        </span>
                      ) : (
                        <span>Original currency: EUR</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {recent.length > 10 && <p className={styles.scrollHint}>Showing 10 transactions at a time · Scroll for older activity</p>}
            </>
          ) : (
            <div className="empty">
              Your financial story begins with your first transaction.
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>EUR reporting standard</h3>
            <Euro size={21} />
          </div>
          <div className={styles.infoCard}>
            <WalletCards size={22} />
            <div>
              <strong>One clear reporting currency</strong>
              <p>
                Overview totals always use <b>amount_eur</b>. Original currencies
                remain visible only as supporting information.
              </p>
            </div>
          </div>
          <div className={styles.infoCard}>
            <RefreshCw size={22} />
            <div>
              <strong>Live synchronization</strong>
              <p>
                Inserts, edits and deletions appear here automatically without a
                manual refresh.
              </p>
            </div>
          </div>
          <div className="stat-row">
            <span>Transactions recorded</span>
            <strong>{transactions.length}</strong>
          </div>
          <div className="stat-row">
            <span>Reporting currency</span>
            <strong>EUR</strong>
          </div>
        </div>
      </section>
    </>
  );
}
