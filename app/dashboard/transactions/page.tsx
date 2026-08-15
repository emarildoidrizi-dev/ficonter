import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { EffortlessEntryWorkspace } from "@/components/EffortlessEntryWorkspace";
import { TransactionLedger } from "@/components/TransactionLedger";
import { MobileTransactionsLayout } from "@/components/MobileTransactionsLayout";
import { canCurrentUserAccessSubscriptionFeature } from "@/lib/subscriptionAccess";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type TransactionsPageProps = {
  searchParams?: Promise<{
    setup?: string | string[];
  }>;
};

function setupTransactionType(value: string | undefined) {
  if (value === "income" || value === "saving") return value;
  return "expense";
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const query = await searchParams;
  const setupValue = Array.isArray(query?.setup) ? query.setup[0] : query?.setup;
  const initialType = setupTransactionType(setupValue);

  const [allowMultiCurrency, allowPdfExport] = await Promise.all([
    canCurrentUserAccessSubscriptionFeature("multi_currency_transactions"),
    canCurrentUserAccessSubscriptionFeature("private_pdf_export"),
  ]);

  const { data, error } = await supabase
    .from("transactions")
    .select("id,description,amount,currency,amount_eur,exchange_rate_to_eur,exchange_rate_date,exchange_rate_source,type,category,transaction_date,occurred_at,created_at")
    .eq("user_id", user.id)
    .order("occurred_at", { ascending: false });

  return (
    <>
      <header className="topbar">
        <div className="page-title">
          <h1>Transactions</h1>
          <p>Review activity or add a transaction without leaving this screen.</p>
        </div>
      </header>
      <MobileTransactionsLayout
        initialView={setupValue ? "add" : "ledger"}
        entry={
          <div className="panel transaction-entry-panel transaction-effortless-panel">
            <EffortlessEntryWorkspace
              initialTransactions={data ?? []}
              initialType={initialType}
              allowMultiCurrency={allowMultiCurrency}
            />
          </div>
        }
        ledger={
          <div className="panel transaction-ledger-panel">
            <div className="panel-head">
              <div>
                <h3>Transactions</h3>
                <p className="muted transaction-intro">Search, filter and manage your financial activity.</p>
              </div>
            </div>
            {error ? (
              <div className="alert alert-error">{error.message}</div>
            ) : (
              <TransactionLedger
                transactions={data ?? []}
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
