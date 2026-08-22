import { redirect } from "next/navigation";
import { EncryptedSavingsWorkspace } from "@/components/EncryptedSavingsWorkspace";
import { getCurrentUser } from "@/lib/auth/currentUser";

import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SavingsPage() {
  await requireSubscriptionFeature("savings_intelligence");
  const { user } = await getCurrentUser();

  if (!user) redirect("/login");

  return <EncryptedSavingsWorkspace userId={user.id} />;
}
