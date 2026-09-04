import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { StagingTestCustomerManager } from "@/components/StagingTestCustomerManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StagingTestCustomerPage() {
  const { user, admin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard/access-denied");
  if (admin.role !== "super_admin") redirect("/dashboard/access-denied");

  return <StagingTestCustomerManager />;
}
