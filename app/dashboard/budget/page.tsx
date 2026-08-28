import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { EncryptedMonthlyPlannerWorkspace } from "@/components/EncryptedMonthlyPlannerWorkspace";
import { canCurrentUserAccessSubscriptionFeature } from "@/lib/subscriptionAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BudgetPage() {
  const { user } = await getCurrentUser();
  if (!user) redirect("/login");

  const showAdvancedPosition = await canCurrentUserAccessSubscriptionFeature(
    "planner_left_after_everything_paid",
  );

  return (
    <EncryptedMonthlyPlannerWorkspace
      userId={user.id}
      showAdvancedPosition={showAdvancedPosition}
    />
  );
}
