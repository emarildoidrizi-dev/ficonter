import { redirect } from "next/navigation";
import { AdminWorkspaceNavigation } from "@/components/AdminWorkspaceNavigation";
import { UiLab } from "@/components/UiLab";
import { isOwnerEmail, requireAdmin } from "@/lib/admin/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UiLabPage() {
  const { user, admin } = await requireAdmin();

  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard");
  if (!isOwnerEmail(user.email)) redirect("/dashboard/admin");

  return (
    <>
      <AdminWorkspaceNavigation showUiLab />
      <UiLab />
    </>
  );
}
