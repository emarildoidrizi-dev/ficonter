import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { canCurrentUserAccessSubscriptionFeature } from "@/lib/subscriptionAccess";
import { TransactionDetailView } from "@/components/TransactionDetailView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TransactionDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TransactionDetailPage({ params }: TransactionDetailPageProps) {
  const { user } = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const allowMultiCurrency = await canCurrentUserAccessSubscriptionFeature("multi_currency_transactions");

  return (
    <>
      <header className="topbar">
        <div className="page-title">
          <h1>Transaction Details</h1>
          <p>Review the complete record and manage this transaction.</p>
        </div>
      </header>
      <TransactionDetailView
        transactionId={id}
        userId={user.id}
        allowMultiCurrency={allowMultiCurrency}
      />
    </>
  );
}
