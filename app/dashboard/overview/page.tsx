import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { EncryptedDashboardOverview } from "@/components/EncryptedDashboardOverview";
import { normalizeFinancialHealthInputs } from "@/lib/wealth/financialHealth";
import { normalizeAiInsightsInputs } from "@/lib/wealth/aiInsights";
import { readSetupAcknowledgements } from "@/lib/wealth/setupReadiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const { user } = await getCurrentUser();

  if (!user) redirect("/login");

  const name =
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    "there";

  return (
    <EncryptedDashboardOverview
      userId={user.id}
      name={name}
      initialTransactions={[]}
      initialBills={[]}
      initialHealthInputs={normalizeFinancialHealthInputs(null)}
      initialSetupAcknowledgements={readSetupAcknowledgements(user.user_metadata)}
      initialGpsInputs={normalizeAiInsightsInputs(null)}
      initialError=""
      initialHealthError=""
      initialGpsError=""
    />
  );
}
