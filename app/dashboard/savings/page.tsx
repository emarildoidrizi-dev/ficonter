import { redirect } from "next/navigation";
import { SavingsIntelligence } from "@/components/SavingsIntelligence";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { normalizeSavingsIntelligenceInputs } from "@/lib/wealth/savingsIntelligence";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SavingsPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc(
    "get_savings_intelligence_inputs",
  );

  return (
    <SavingsIntelligence
      userId={user.id}
      initialInputs={normalizeSavingsIntelligenceInputs(data)}
      initialError={error?.message ?? ""}
    />
  );
}
