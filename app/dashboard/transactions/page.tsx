import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { EncryptedTransactionsWorkspace } from "@/components/EncryptedTransactionsWorkspace";
import { canCurrentUserAccessSubscriptionFeature } from "@/lib/subscriptionAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TransactionsPageProps = {
  searchParams?: Promise<{
    setup?: string | string[];
    add?: string | string[];
  }>;
};

function setupTransactionType(value: string | undefined) {
  if (value === "income" || value === "saving") return value;
  return "expense";
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const { user } = await getCurrentUser();

  if (!user) redirect("/login");

  const query = await searchParams;
  const setupValue = Array.isArray(query?.setup)
    ? query.setup[0]
    : query?.setup;
  const addValue = Array.isArray(query?.add)
    ? query.add[0]
    : query?.add;

  const directAdd = addValue === "1";
  const initialType = setupTransactionType(setupValue);

  const [allowMultiCurrency, allowPdfExport] =
    await Promise.all([
      canCurrentUserAccessSubscriptionFeature(
        "multi_currency_transactions",
      ),
      canCurrentUserAccessSubscriptionFeature(
        "private_pdf_export",
      ),
    ]);

  return (
    <>
      <header className="topbar">
        <div className="page-title">
          <h1>Transactions</h1>
          <p>
            Review activity or add a transaction without
            leaving this screen.
          </p>
        </div>
      </header>

      <EncryptedTransactionsWorkspace
        initialType={initialType}
        allowMultiCurrency={allowMultiCurrency}
        allowPdfExport={allowPdfExport}
        directAdd={directAdd}
        setupRequested={Boolean(setupValue)}
      />
    </>
  );
}