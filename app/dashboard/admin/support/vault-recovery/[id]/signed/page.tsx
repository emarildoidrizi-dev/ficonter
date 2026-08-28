import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { PrintRecoveryConsentButton } from "@/components/PrintRecoveryConsentButton";
import { requireAdmin } from "@/lib/admin/access";
import { getAdminSignedRecoveryConsent } from "@/lib/admin/vaultRecoverySignedView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmt(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

export default async function SignedRecoveryConsentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, admin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard");

  const { id } = await params;
  const data = await getAdminSignedRecoveryConsent(id).catch(() => null);
  if (!data) notFound();

  const { request, document } = data;
  const address = [
    request.customer_address_line1,
    request.customer_address_line2,
    [request.customer_postal_code, request.customer_city].filter(Boolean).join(" "),
    request.country_region,
  ].filter(Boolean).join(", ");

  return (
    <main className="signed-shell">
      <div className="no-print print-action"><PrintRecoveryConsentButton /></div>
      <article className="signed-document">
        <header className="letterhead">
          <div className="brand-line">
            <Image src="/ficonter-mark.svg" alt="FICONTER emblem" width={42} height={42} />
            <div><div className="brand-name">FICONTER</div><div className="confidential">SIGNED VAULT RECOVERY AUTHORIZATION</div></div>
          </div>
          <div className="doc-ref">
            <div><strong>Document ID:</strong> {document.document_id}</div>
            <div><strong>Recovery request:</strong> {request.reference}</div>
            <div><strong>Sent to customer:</strong> {fmt(document.sent_to_customer_at)}</div>
            <div><strong>Signed & submitted:</strong> {fmt(document.customer_signed_at)}</div>
          </div>
        </header>

        <section className="title-block">
          <h1>Vault Assisted Recovery Consent & Authorization</h1>
          <p>This is the electronically signed FICONTER authorization record for this recovery request.</p>
        </section>

        <section>
          <h2>Customer information</h2>
          <div className="grid">
            <div><small>Customer full name</small><strong>{request.customer_name || "Not provided"}</strong></div>
            <div><small>Registered FICONTER email</small><strong>{request.customer_email}</strong></div>
            <div><small>FICONTER account / user ID</small><strong>{request.user_id}</strong></div>
            <div><small>Recovery request ID</small><strong>{request.reference}</strong></div>
            <div><small>Country / region</small><strong>{request.country_region || "Not provided"}</strong></div>
            <div><small>City</small><strong>{request.customer_city || "Not provided"}</strong></div>
            <div className="full"><small>Residential address</small><strong>{address || "Not provided"}</strong></div>
          </div>
        </section>

        <section>
          <h2>Mandatory customer authorization</h2>
          <p>By electronically signing and submitting this document, the authenticated customer confirmed that normal Vault recovery methods had failed or were no longer available, authorized FICONTER to process this specific Assisted Recovery request, accepted that a previous recovery credential may be invalidated and replaced after successful recovery, and confirmed the Security & Data Protection Commitment.</p>
        </section>

        <section>
          <h2>Electronic signature</h2>
          <div className="signature-box">{document.customer_signature}</div>
          <div className="signature-meta">
            <div><small>Signature method</small><strong>Authenticated electronic signature</strong></div>
            <div><small>Signed & submitted</small><strong>{fmt(document.customer_signed_at)}</strong></div>
          </div>
        </section>

        <footer><div>FICONTER Vault Assisted Recovery</div><div>{document.document_id} · {request.reference}</div></footer>
      </article>
      <style>{`
        .signed-shell{width:100%;max-width:860px;margin:24px auto 56px;padding:0 20px;box-sizing:border-box}.print-action{display:flex;justify-content:flex-end;margin-bottom:12px}.signed-document{background:#fff;color:#1f1f1f;padding:34px 38px;border:1px solid #d8d8d8;box-shadow:0 8px 28px rgba(0,0,0,.06);font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55}.letterhead{display:flex;justify-content:space-between;gap:20px;padding-bottom:14px;border-bottom:1px solid #222}.brand-line{display:flex;align-items:center;gap:11px}.brand-name{font-size:18px;font-weight:800;letter-spacing:.04em}.confidential{font-size:9px;letter-spacing:.12em;color:#666}.doc-ref{text-align:right;font-size:10.5px;line-height:1.6;color:#4a4a4a}.title-block{padding:24px 0 6px}.title-block h1{margin:0;font-size:20px}.title-block p{margin:6px 0 0;color:#555}section{margin-top:22px}h2{font-size:14px;margin:0 0 10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px}.grid>div{display:grid;gap:4px;border-bottom:1px solid #bbb;padding-bottom:7px}.grid small,.signature-meta small{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#666}.grid strong,.signature-meta strong{font-size:12.5px;overflow-wrap:anywhere}.full{grid-column:1/-1}.signature-box{min-height:70px;border:1px solid #777;border-radius:8px;padding:16px;font-size:24px;font-family:cursive;display:flex;align-items:center}.signature-meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:12px}.signature-meta>div{display:grid;gap:4px}footer{display:flex;justify-content:space-between;margin-top:34px;padding-top:10px;border-top:1px solid #bbb;font-size:9.5px;color:#666}@media print{@page{size:A4;margin:12mm 14mm}.no-print{display:none!important}.signed-shell{max-width:none;margin:0;padding:0}.signed-document{border:0;box-shadow:none;padding:0}}@media(max-width:700px){.letterhead{flex-direction:column}.doc-ref{text-align:left}.grid,.signature-meta{grid-template-columns:1fr}.full{grid-column:auto}}
      `}</style>
    </main>
  );
}
