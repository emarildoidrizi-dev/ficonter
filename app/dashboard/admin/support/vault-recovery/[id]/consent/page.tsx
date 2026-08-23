import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { PrintRecoveryConsentButton } from "@/components/PrintRecoveryConsentButton";
import { requireAdmin } from "@/lib/admin/access";
import { getVaultRecoveryConsentDocument } from "@/lib/admin/vaultRecovery";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatGenerated(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(value));
}

export default async function RecoveryConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, admin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard");

  const { id } = await params;
  const { request, document } = await getVaultRecoveryConsentDocument(id).catch(() => ({ request: null, document: null }));
  if (!request || !document) notFound();

  return (
    <main style={{ maxWidth: 900, margin: "24px auto", padding: "0 24px 60px" }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}><PrintRecoveryConsentButton /></div>
      <article style={{ background: "white", color: "#17272a", padding: 42, borderRadius: 16, boxShadow: "0 10px 40px rgba(0,0,0,.08)" }}>
        <header style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 24, alignItems: "start", marginBottom: 24 }}>
          <Image src="/ficonter-mark.svg" alt="FICONTER emblem" width={88} height={88} />
          <div><div style={{ fontSize: 34, fontWeight: 800, letterSpacing: ".02em" }}>FICONTER</div><h1 style={{ margin: "8px 0 4px", fontSize: 25 }}>Vault Assisted Recovery — Customer Consent & Authorization Form</h1><p style={{ margin: 0, color: "#687274" }}>Official document generated for this specific recovery request.</p></div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", border: "1px solid #d9e1df", marginBottom: 22 }}>
          {[['DOCUMENT ID', document.document_id], ['RECOVERY REQUEST', request.reference], ['GENERATED ON', formatGenerated(document.generated_at)]].map(([label, value]) => <div key={label} style={{ padding: "10px 12px", borderRight: label !== 'GENERATED ON' ? "1px solid #d9e1df" : undefined }}><div style={{ fontSize: 11, fontWeight: 800, color: "#657170" }}>{label}</div><div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>{value}</div></div>)}
        </section>

        <section style={{ background: "#edf6f3", border: "1px solid #b8d5cd", padding: 16, marginBottom: 24 }}><strong>YOUR FINANCIAL DATA REMAINS YOURS</strong><p>FICONTER is designed to protect your financial information with strong encryption and strict access controls. Assisted recovery is limited to restoring access to your Vault and does not authorize FICONTER personnel to inspect or use your financial records.</p><p style={{ marginBottom: 0 }}>FICONTER will not sell, rent, trade, monetize, distribute, or disclose your financial data to any third party for advertising, marketing, profiling, data-brokerage, or unrelated commercial purposes. FICONTER will not copy, export, or transfer your decrypted financial records as part of this assisted-recovery request. Any disclosure required by applicable law will be limited to what the law requires.</p></section>

        <h2>1. Customer and recovery request details</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}><div><strong>Registered FICONTER email</strong><div style={{ borderBottom: "1px solid #aaa", padding: "8px 0" }}>{request.customer_email}</div></div><div><strong>Recovery request</strong><div style={{ borderBottom: "1px solid #aaa", padding: "8px 0" }}>{request.reference}</div></div><div><strong>Customer full name</strong><div style={{ borderBottom: "1px solid #aaa", padding: "8px 0" }}>________________________________</div></div><div><strong>Country / region</strong><div style={{ borderBottom: "1px solid #aaa", padding: "8px 0" }}>________________________________</div></div></div>

        <h2>2. Customer declaration & authorization</h2>
        <p>By signing this document, I confirm that my normal recovery methods have failed and I am requesting FICONTER Assisted Recovery as a last resort.</p>
        <p>☐ I authorize FICONTER to perform this specific assisted-recovery request.</p>
        <p>☐ I understand that my previous recovery credential will be invalidated and replaced after successful recovery.</p>
        <p>☐ I confirm that I have read and understood the FICONTER Security & Data Protection Commitment above.</p>

        <h2>3. Security acknowledgements</h2>
        <p>I understand that recovery may be delayed, rejected, or cancelled if identity or security verification cannot be completed; that any recovery link is single-use and time-limited; and that I am responsible for securely saving the replacement recovery credential when it is presented.</p>

        <h2>4. Customer signature</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}><div><strong>Customer full name</strong><div style={{ borderBottom: "1px solid #777", height: 42 }} /></div><div><strong>Date</strong><div style={{ borderBottom: "1px solid #777", height: 42 }} /></div><div><strong>Customer signature</strong><div style={{ borderBottom: "1px solid #777", height: 54 }} /></div><div><strong>Place / city</strong><div style={{ borderBottom: "1px solid #777", height: 54 }} /></div></div>
      </article>
      <style>{`@media print { body { background: white !important; } .no-print { display:none !important; } main { margin:0 !important; padding:0 !important; max-width:none !important; } article { box-shadow:none !important; border-radius:0 !important; padding:24px !important; } }`}</style>
    </main>
  );
}
