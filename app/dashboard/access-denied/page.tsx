import { redirect } from "next/navigation";

import { AdminAccessDeniedDialog } from "@/components/AdminAccessDeniedDialog";
import { getCurrentUser } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccessDeniedPage() {
  const { user } = await getCurrentUser();
  if (!user) redirect("/login");

  return <AdminAccessDeniedDialog />;
}
