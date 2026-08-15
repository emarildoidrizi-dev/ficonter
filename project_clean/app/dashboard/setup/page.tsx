import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { FinancialSetupGuide } from "@/components/FinancialSetupGuide";
import { normalizeFinancialHealthInputs } from "@/lib/wealth/financialHealth";
import { readSetupAcknowledgements } from "@/lib/wealth/setupReadiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FinancialSetupPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("get_financial_health_inputs");

  return (
    <section>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Profile readiness</div>
          <h1>Financial setup</h1>
          <p>
            Confirm the information FICONTER needs to distinguish missing data
            from a genuine zero balance.
          </p>
        </div>
      </div>

      <FinancialSetupGuide
        userId={user.id}
        initialInputs={normalizeFinancialHealthInputs(data)}
        initialAcknowledgements={readSetupAcknowledgements(user.user_metadata)}
        initialError={error?.message ?? ""}
      />
    </section>
  );
}
