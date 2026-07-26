import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NetWorthLive } from "@/components/NetWorthLive";
import { normalizeWealthScoreInputs } from "@/lib/wealth/wealthScore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NetWorthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("get_wealth_score_inputs");

  return (
    <NetWorthLive
      userId={user.id}
      initialWealthInputs={normalizeWealthScoreInputs(data)}
      initialError={error?.message ?? ""}
    />
  );
}
