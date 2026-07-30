import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { NetWorthLive } from "@/components/NetWorthLive";
import { normalizeNetWorthGrowthInputs } from "@/lib/wealth/netWorthGrowth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NetWorthPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("get_net_worth_growth_inputs");

  return (
    <NetWorthLive
      userId={user.id}
      initialGrowthInputs={normalizeNetWorthGrowthInputs(data)}
      initialError={error?.message ?? ""}
    />
  );
}
