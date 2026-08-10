import { redirect } from "next/navigation";
import { isOwnerEmail, requireAdmin } from "@/lib/admin/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UiLabPage() {
  const { user, admin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!admin || !isOwnerEmail(user.email)) redirect("/dashboard/admin");

  // V25 replaces the preview-only gallery with the real live layout selector.
  redirect("/dashboard/settings?section=appearance");
}
