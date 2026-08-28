import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { EncryptedFinancialSetupWorkspace } from "@/components/EncryptedFinancialSetupWorkspace";
import { readSetupAcknowledgements } from "@/lib/wealth/setupReadiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FinancialSetupPage() {
  const { user } = await getCurrentUser();

  if (!user) redirect("/login");

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

      <EncryptedFinancialSetupWorkspace
        userId={user.id}
        initialAcknowledgements={readSetupAcknowledgements(user.user_metadata)}
      />
    </section>
  );
}
