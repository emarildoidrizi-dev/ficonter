import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionLedger } from "@/components/TransactionLedger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TransactionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
          <p>Search, analyze and manage every movement of money.</p>
        </div>
      </header>
      <section className="transactions-layout">
        <div className="panel transaction-entry-panel">
          <h3>Add transaction</h3>
          <p className="muted transaction-intro">Record income and expenses as they happen.</p>
          <TransactionForm />
        </div>
        <div className="panel transaction-ledger-panel">
          <div className="panel-head">
            <div>
              <h3>Your ledger</h3>
              <p className="muted transaction-intro">Edit, filter, export and review your financial activity.</p>
            </div>
          </div>
          {error ? <div className="alert alert-error">{error.message}</div> : <TransactionLedger transactions={data ?? []} />}
        </div>
      </section>
    </>
  );
}
