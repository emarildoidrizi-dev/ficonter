import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { EncryptedGoalsWorkspace } from "@/components/EncryptedGoalsWorkspace";

import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GoalsPage() {
  await requireSubscriptionFeature("goals");
  const { user } = await getCurrentUser();

  if (!user) redirect("/login");

  return <EncryptedGoalsWorkspace userId={user.id} />;
}
