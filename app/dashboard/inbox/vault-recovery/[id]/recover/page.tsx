import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { getCustomerVaultRecoveryAccess } from "@/lib/vaultRecovery/customerAccess";
import { VaultRecoveryCustomerAccessV2 } from "@/components/VaultRecoveryCustomerAccessV2";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerVaultRecoveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const recovery = await getCustomerVaultRecoveryAccess({
    recoveryRequestId: id,
    userId: user.id,
  }).catch(() => null);

  if (!recovery) notFound();

  return (
    <main style={{ width: "min(900px,calc(100% - 28px))", margin: "28px auto 56px", display: "grid", gap: 18 }}>
      <Link href="/dashboard/inbox" style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7, width: "fit-content", fontWeight: 700 }}><ArrowLeft size={16} />Back to Inbox</Link>

      <article style={{ border: "1px solid rgba(120,120,120,.18)", borderRadius: 20, padding: "clamp(20px,4vw,34px)", background: "rgba(255,255,255,.42)", display: "grid", gap: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", paddingBottom: 18, borderBottom: "1px solid rgba(120,120,120,.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Image src="/ficonter-mark.svg" alt="FICONTER emblem" width={44} height={44} />
            <div><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", opacity: .58 }}>SECURE CUSTOMER RECOVERY</div><h1 style={{ margin: "4px 0 0", fontSize: 26 }}>Vault Recovery Center</h1></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid rgba(31,90,76,.2)", borderRadius: 999, padding: "8px 12px", height: "fit-content", fontSize: 13 }}><ShieldCheck size={15} />Account protected</div>
        </header>

        <section style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 9, alignItems: "center" }}><LockKeyhole size={20} /><strong>{recovery.reference}</strong></div>
          <p style={{ margin: 0, lineHeight: 1.65, opacity: .72 }}>Your approved Assisted Recovery authorization is separate from your encrypted Financial Vault. FICONTER personnel cannot use this page to view your decrypted financial records or your permanent recovery credential.</p>
        </section>

        <section style={{ borderTop: "1px solid rgba(120,120,120,.16)", paddingTop: 20 }}>
          <VaultRecoveryCustomerAccessV2 recoveryRequestId={recovery.requestId} initialAccess={recovery.access} />
        </section>

        <section style={{ padding: 16, borderRadius: 14, background: "rgba(120,120,120,.06)", fontSize: 13, lineHeight: 1.65 }}>
          <strong>What happens next?</strong>
          <div style={{ marginTop: 5, opacity: .72 }}>After the temporary authorization is claimed, FICONTER must restore access to the same encrypted Vault key through the protected recovery-key mechanism. Your replacement recovery credential will be generated on your device, not by an administrator.</div>
        </section>
      </article>
    </main>
  );
}
