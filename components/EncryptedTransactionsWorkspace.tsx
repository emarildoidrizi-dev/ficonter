"use client";

import { EffortlessEntryWorkspace } from "@/components/EffortlessEntryWorkspace";
import { TransactionLedger } from "@/components/TransactionLedger";
import { MobileTransactionsLayout } from "@/components/MobileTransactionsLayout";
import { useEncryptedTransactions } from "@/components/EncryptedTransactionProvider";

type Props = {
  initialType: "expense" | "income" | "saving";
  allowMultiCurrency: boolean;
  allowPdfExport: boolean;
  directAdd: boolean;
  setupRequested: boolean;
};

export function EncryptedTransactionsWorkspace({
  initialType,
  allowMultiCurrency,
  allowPdfExport,
  directAdd,
  setupRequested,
}: Props) {
  const { transactions, loading, error } =
    useEncryptedTransactions();

  return (
    <MobileTransactionsLayout
      initialView={
        directAdd || setupRequested ? "add" : "ledger"
      }
      entry={
        <div className="panel transaction-entry-panel transaction-effortless-panel">
          <EffortlessEntryWorkspace
            initialTransactions={transactions}
            initialType={initialType}
            allowMultiCurrency={allowMultiCurrency}
            directAdd={directAdd}
          />
        </div>
      }
      ledger={
        <div className="panel transaction-ledger-panel">
          <div className="panel-head">
            <div>
              <h3>Transactions</h3>
              <p className="muted transaction-intro">
                Search, filter and manage your financial activity.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="alert">
              Opening encrypted transactionsâ€¦
            </div>
          ) : error ? (
            <div className="alert alert-error">{error}</div>
          ) : (
            <TransactionLedger
              transactions={transactions}
              allowMultiCurrency={allowMultiCurrency}
              allowPdfExport={allowPdfExport}
            />
          )}
        </div>
      }
    />
  );
}