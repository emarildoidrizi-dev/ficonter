import { redirect } from "next/navigation";
import { VaultRecoveryCaseManager } from "@/components/VaultRecoveryCaseManager";
import { requireAdmin } from "@/lib/admin/access";
import { listRecoveryDirectoryCustomers } from "@/lib/admin/recoveryDirectory";
import { listVaultRecoveryCases } from "@/lib/admin/vaultRecovery";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VaultRecoveryAdminPage() {
  const { user, admin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard");

  const [customers, cases] = await Promise.all([listRecoveryDirectoryCustomers(), listVaultRecoveryCases()]);
  return <VaultRecoveryCaseManager initialCustomers={customers} initialCases={cases} />;
}
