"use client";

import { useMemo } from "react";
import { EffortlessEntryWorkspace } from "@/components/EffortlessEntryWorkspace";
import { CompactTransactionLedger } from "@/components/CompactTransactionLedger";
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

export function EncryptedTransactionsWorkspace(props: Props) {
  const { status: vaultStatus, vaultKey } = useVault();

  if (vaultStatus !== "unlocked" || !vaultKey) {
    return (
      <div className="panel">
        <div className="alert">
          Unlock your Financial Vault to open Transactions.
        </div>
      </div>
    );
  }

  return <UnlockedTransactionsWorkspace {...props} vaultKey={vaultKey} />;
}

function UnlockedTransactionsWorkspace({
  userId,
  initialType,
  allowMultiCurrency,
  allowPdfExport,
  directAdd,
  setupRequested,
  vaultKey,
}: Props & { vaultKey: CryptoKey }) {
  const supabase = useMemo(() => createClient(), []);
  const { transactions, loading, error } = useEncryptedTransactions();

  installTransactionTemplateE2eeBoundary(supabase, vaultKey, userId);

  return (
    <>
      <header className="topbar">
        <div className="page-title">
          <h1>Transactions</h1>
          <p>Review activity or add a transaction without leaving this screen.</p>
        </div>
      </header>

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
                  A compact ledger for scanning activity. Open any transaction for its complete record and actions.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="alert">Opening encrypted transactions…</div>
            ) : error ? (
              <div className="alert alert-error">{error}</div>
            ) : (
              <CompactTransactionLedger
                transactions={transactions}
                allowMultiCurrency={allowMultiCurrency}
                allowPdfExport={allowPdfExport}
              />
            )}
          </div>
        }
      />
    </>
  );
}
