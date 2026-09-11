import { redirect } from "next/navigation";

import { AskFiconterPageClient } from "@/components/AskFiconterPageClient";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireSubscriptionFeature } from "@/lib/subscriptionRouteAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AskFiconterPage() {
  const { user, supabase } = await getCurrentUser();

  if (!user) redirect("/login?entry=app");

  await requireSubscriptionFeature("advanced_financial_recommendations");

  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AskFiconterPageClient
      userId={user.id}
      baseCurrency={profile?.base_currency ?? "EUR"}
    />
  );
}
