import { redirect } from "next/navigation";
import { VaultRecoveryCaseManager } from "@/components/VaultRecoveryCaseManager";
import { requireAdmin } from "@/lib/admin/access";
import { listRecoveryDirectoryCustomers } from "@/lib/admin/recoveryDirectory";
import { listVaultRecoveryCases } from "@/lib/admin/vaultRecovery";
import { attachRecoveryDeliveryState } from "@/lib/admin/vaultRecoveryInbox";
import { attachRecoveryAccessState } from "@/lib/admin/vaultRecoveryAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VaultRecoveryAdminPage() {
  const { user, admin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard");

  const [customers, rawCases] = await Promise.all([
    listRecoveryDirectoryCustomers(),
    listVaultRecoveryCases(),
  ]);
  const deliveryCases = await attachRecoveryDeliveryState(rawCases as any[]);
  const cases = await attachRecoveryAccessState(deliveryCases as any[]);

  return <VaultRecoveryCaseManager initialCustomers={customers} initialCases={cases as any} />;
}
