"use client";

import { useMemo } from "react";
import { EffortlessEntryWorkspace } from "@/components/EffortlessEntryWorkspace";
import { TransactionLedger } from "@/components/TransactionLedger";
import { MobileTransactionsLayout } from "@/components/MobileTransactionsLayout";
import { useEncryptedTransactions } from "@/components/EncryptedTransactionProvider";
import { useVault } from "@/components/VaultProvider";
import { createClient } from "@/lib/supabase/client";
import { installTransactionTemplateE2eeBoundary } from "@/lib/e2ee/transactionTemplateBoundary";

type Props = {
  userId: string;
  initialType: "expense" | "income" | "saving";
  allowMultiCurrency: boolean;
  allowPdfExport: boolean;
  directAdd: boolean;
  setupRequested: boolean;
};

export function EncryptedTransactionsWorkspace({
  userId,
  initialType,
  allowMultiCurrency,
  allowPdfExport,
  directAdd,
  setupRequested,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { status: vaultStatus, vaultKey } = useVault();
  const { transactions, loading, error } = useEncryptedTransactions();

  if (vaultStatus === "unlocked" && vaultKey) {
    installTransactionTemplateE2eeBoundary(supabase, vaultKey, userId);
  }

  return (
    <MobileTransactionsLayout
      initialView={directAdd || setupRequested ? "add" : "ledger"}
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
            <div className="alert">Opening encrypted transactions…</div>
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
