import { redirect } from "next/navigation";
import { SupportInbox } from "@/components/SupportInbox";
import { requireAdmin } from "@/lib/admin/access";
import { loadSupportRequests } from "@/lib/admin/support";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSupportPage() {
  const { user, admin } = await requireAdmin();

  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard");

  const requests = await loadSupportRequests();
  return <SupportInbox initialRequests={requests} />;
}
