import { redirect } from "next/navigation";
import { EncryptedDebtWorkspace } from "@/components/EncryptedDebtWorkspace";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DebtPage() {
  await requireSubscriptionFeature("debt");
  const { user } = await getCurrentUser();

  if (!user) redirect("/login");

  return <EncryptedDebtWorkspace userId={user.id} />;
}
