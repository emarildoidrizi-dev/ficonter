import { redirect } from "next/navigation";
import { EncryptedBusinessAdministrationWorkspace } from "@/components/EncryptedBusinessAdministrationWorkspace";
import { getBusinessContext } from "@/lib/business/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessAdministrationPage() {
  const { user, business, membership } = await getBusinessContext();
  if (!user) redirect("/login");
  if (!business) redirect("/business/manage");

  const canManage = membership?.role === "owner" || membership?.role === "admin";
  if (!canManage) {
    return (
      <section style={{ padding: "32px" }}>
        <h1>Business Administration</h1>
        <p>Only the business owner or an administrator can open this area.</p>
      </section>
    );
  }

  return (
    <EncryptedBusinessAdministrationWorkspace
      userId={user.id}
      role={membership?.role ?? "viewer"}
      business={business}
    />
  );
}
