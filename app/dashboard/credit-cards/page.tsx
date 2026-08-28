import { redirect } from "next/navigation";
import { EncryptedCreditCardsWorkspace } from "@/components/EncryptedCreditCardsWorkspace";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CreditCardsPage() {
  await requireSubscriptionFeature("credit_cards");
  const { user } = await getCurrentUser();

  if (!user) redirect("/login");

  return <EncryptedCreditCardsWorkspace userId={user.id} />;
}
