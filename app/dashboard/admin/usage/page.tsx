import { redirect } from "next/navigation";
import { AdminWorkspaceNavigation } from "@/components/AdminWorkspaceNavigation";
import { PlatformUsageDirectory } from "@/components/PlatformUsageDirectory";
import { isOwnerEmail, requireAdmin } from "@/lib/admin/access";
import { loadPlatformUsageSnapshot } from "@/lib/admin/usage";
import { getCurrentUser } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PersonalUsageAdminPage() {
  const { user, admin } = await requireAdmin();

  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard");

  const { supabase } = await getCurrentUser();
  const snapshot = await loadPlatformUsageSnapshot(
    supabase,
    "personal",
  );

  return (
    <>
      <AdminWorkspaceNavigation showUiLab={isOwnerEmail(user.email)} />
      <PlatformUsageDirectory
        scope="personal"
        initialRows={snapshot.rows}
        initialOverview={snapshot.overview}
        initialError={
          snapshot.errors.directory ??
          snapshot.errors.overview ??
          ""
        }
      />
    </>
  );
}
