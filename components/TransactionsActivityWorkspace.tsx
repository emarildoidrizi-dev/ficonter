"use client";

import { ClipboardList, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { EffortlessEntryWorkspace } from "./EffortlessEntryWorkspace";
import { TransactionLedger } from "./TransactionLedger";
import styles from "./TransactionsActivityWorkspace.module.css";

type Transaction = {
  id: string;
  description: string;
  amount: number | string;
  currency: string;
  amount_eur: number | string;
  exchange_rate_to_eur: number | string;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
  type: string;
  category: string;
  transaction_date: string;
  occurred_at: string | null;
  created_at?: string | null;
};

type Props = {
  transactions: Transaction[];
  initialType?: "expense" | "income" | "saving";
  allowMultiCurrency?: boolean;
  allowPdfExport?: boolean;
  ledgerError?: string;
};

type MobileView = "add" | "ledger";

export function TransactionsActivityWorkspace({
  transactions,
  initialType = "expense",
  allowMultiCurrency = true,
  allowPdfExport = true,
  ledgerError = "",
}: Props) {
  const [mobileView, setMobileView] = useState<MobileView>("add");

  useEffect(() => {
    const showAdd = () => setMobileView("add");
    const showLedger = () => setMobileView("ledger");

    window.addEventListener("ficonter:quick-add-transaction", showAdd);
    window.addEventListener("ficonter:show-transaction-ledger", showLedger);

    return () => {
      window.removeEventListener("ficonter:quick-add-transaction", showAdd);
      window.removeEventListener("ficonter:show-transaction-ledger", showLedger);
    };
  }, []);

  return (
    <section className={styles.activityWorkspace} aria-label="Activity workspace">
      <div className={styles.mobileSwitcher} role="tablist" aria-label="Activity view">
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === "add"}
          className={mobileView === "add" ? styles.activeTab : styles.tab}
          onClick={() => setMobileView("add")}
        >
          <Plus size={19} aria-hidden="true" />
          <span>Add transaction</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === "ledger"}
          className={mobileView === "ledger" ? styles.activeTab : styles.tab}
          onClick={() => setMobileView("ledger")}
        >
          <ClipboardList size={18} aria-hidden="true" />
          <span>Ledger</span>
        </button>
      </div>

      <div
        className={`${styles.entryView} ${mobileView !== "add" ? styles.mobileInactive : ""}`}
        role="tabpanel"
        aria-label="Add transaction"
      >
        <div className="panel transaction-entry-panel transaction-effortless-panel">
          <EffortlessEntryWorkspace
            initialTransactions={transactions}
            initialType={initialType}
            allowMultiCurrency={allowMultiCurrency}
          />
        </div>
      </div>

      <div
        className={`${styles.ledgerView} ${mobileView !== "ledger" ? styles.mobileInactive : ""}`}
        role="tabpanel"
        aria-label="Ledger"
      >
        <div className="panel transaction-ledger-panel">
          <div className={styles.ledgerDesktopHeading}>
            <div className="panel-head">
              <div>
                <h3>Your ledger</h3>
                <p className="muted transaction-intro">
                  Edit, filter, export and review your financial activity.
                </p>
              </div>
            </div>
          </div>
          {ledgerError ? (
            <div className="alert alert-error">{ledgerError}</div>
          ) : (
            <TransactionLedger
              transactions={transactions}
              allowMultiCurrency={allowMultiCurrency}
              allowPdfExport={allowPdfExport}
            />
          )}
        </div>
      </div>
    </section>
  );
}
