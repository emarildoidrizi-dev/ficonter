import { redirect } from "next/navigation";
import { VaultRecoveryRecords } from "@/components/VaultRecoveryRecords";
import { requireAdmin } from "@/lib/admin/access";
import { listVaultRecoveryCases } from "@/lib/admin/vaultRecovery";
import { attachRecoveryDeliveryState } from "@/lib/admin/vaultRecoveryInbox";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RecoveryRecordsAdminPage() {
  const { user, admin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard");

  const rawCases = await listVaultRecoveryCases();
  const cases = await attachRecoveryDeliveryState(rawCases as any[]);

  return <VaultRecoveryRecords cases={cases as any} />;
}
