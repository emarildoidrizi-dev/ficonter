import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
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
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Link
          href="/dashboard/admin/support/vault-recovery"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(23,63,66,.22)",
            background: "rgba(255,255,255,.72)",
            color: "#173f42",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <LockKeyhole size={16} aria-hidden="true" />
          Vault Recovery
        </Link>
      </div>
      <SupportInbox initialRequests={requests} />
    </>
  );
}
