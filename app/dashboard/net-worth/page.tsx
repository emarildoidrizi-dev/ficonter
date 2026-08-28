import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { NetWorthLive } from "@/components/NetWorthLive";

import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NetWorthPage() {
  await requireSubscriptionFeature("net_worth_growth");
  const { user } = await getCurrentUser();

  if (!user) redirect("/login");

  return <NetWorthLive userId={user.id} />;
}
