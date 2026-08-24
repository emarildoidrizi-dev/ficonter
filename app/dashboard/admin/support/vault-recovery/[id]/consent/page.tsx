import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { PrintRecoveryConsentButton } from "@/components/PrintRecoveryConsentButton";
import { requireAdmin } from "@/lib/admin/access";
import { getVaultRecoveryConsentDocument } from "@/lib/admin/vaultRecovery";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RECOVERY_DOCUMENT_TIME_ZONE = "Europe/Berlin";

function formatGenerated(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: RECOVERY_DOCUMENT_TIME_ZONE,
    timeZoneName: "short",
  }).format(new Date(value));
}

const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "#555",
  marginBottom: 5,
};

const fieldValue: React.CSSProperties = {
  minHeight: 25,
  borderBottom: "1px solid #9c9c9c",
  fontSize: 13,
  lineHeight: 1.45,
  paddingBottom: 4,
};

export default async function RecoveryConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, admin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!admin) redirect("/dashboard");

  const { id } = await params;
  const { request, document } = await getVaultRecoveryConsentDocument(id).catch(() => ({ request: null, document: null }));
  if (!request || !document) notFound();

  return (
    <main className="consent-shell">
      <div className="no-print print-action"><PrintRecoveryConsentButton /></div>

      <article className="consent-document">
        <header className="letterhead">
          <div className="brand-line">
            <Image src="/ficonter-mark.svg" alt="FICONTER emblem" width={42} height={42} />
            <div>
              <div className="brand-name">FICONTER</div>
              <div className="confidential">CONFIDENTIAL CUSTOMER AUTHORIZATION</div>
            </div>
          </div>
          <div className="doc-ref">
            <div><strong>Document ID:</strong> {document.document_id}</div>
            <div><strong>Recovery request:</strong> {request.reference}</div>
            <div><strong>Generated:</strong> {formatGenerated(document.generated_at)}</div>
          </div>
        </header>

        <section className="title-block">
          <h1>Vault Assisted Recovery Consent & Authorization</h1>
          <p>This form records the customer&apos;s explicit authorization for FICONTER to process a last-resort Vault recovery request.</p>
        </section>

        <section>
          <h2>1. Customer information</h2>
          <div className="field-grid">
            <div><div style={fieldLabel}>Customer full name</div><div style={fieldValue}>{request.customer_name || ""}</div></div>
            <div><div style={fieldLabel}>Registered FICONTER email</div><div style={fieldValue}>{request.customer_email}</div></div>
            <div><div style={fieldLabel}>FICONTER account / user ID</div><div style={fieldValue}>{request.user_id}</div></div>
            <div><div style={fieldLabel}>Recovery request ID</div><div style={fieldValue}>{request.reference}</div></div>
            <div><div style={fieldLabel}>Country / region</div><div style={fieldValue}>{request.country_region || ""}</div></div>
            <div><div style={fieldLabel}>Date request opened</div><div style={fieldValue}>{formatGenerated(request.created_at)}</div></div>
          </div>
        </section>

        <section>
          <h2>2. Customer declaration</h2>
          <p>I confirm that I am requesting assistance because I cannot regain access to my FICONTER Vault using the normal recovery methods available to me.</p>
          <p>I understand that this process is limited to restoring access to my Vault. It does not authorize FICONTER personnel to inspect, use, copy, export, or otherwise access my decrypted financial records except to the extent strictly required by the approved recovery process.</p>
        </section>

        <section>
          <h2>3. Consent and authorization</h2>
          <div className="consent-list">
            <label><span className="box" /> <span>I authorize FICONTER to process this specific assisted-recovery request.</span></label>
            <label><span className="box" /> <span>I confirm that my normal recovery methods have failed or are no longer available to me.</span></label>
            <label><span className="box" /> <span>I understand that any previous recovery credential may be invalidated and replaced after successful recovery.</span></label>
            <label><span className="box" /> <span>I confirm that I have read and understood the Security & Data Protection Commitment below.</span></label>
          </div>
        </section>

        <section>
          <h2>4. Security & data protection commitment</h2>
          <p>FICONTER is designed to protect customer financial information through strong encryption and strict access controls. Assisted recovery is intended only to restore customer access to the Vault.</p>
          <p>FICONTER will not sell, rent, trade, monetize, distribute, or disclose customer financial data to third parties for advertising, marketing, profiling, data-brokerage, or unrelated commercial purposes. Any disclosure required by applicable law will be limited to what the law requires.</p>
        </section>

        <section>
          <h2>5. Customer signature</h2>
          <p>By signing below, I confirm that the information provided in this form is correct and that I give the authorization described above voluntarily and specifically for this recovery request.</p>
          <div className="signature-grid">
            <div><div style={fieldLabel}>Customer full name</div><div className="signature-line" /></div>
            <div><div style={fieldLabel}>Date</div><div className="signature-line" /></div>
            <div><div style={fieldLabel}>Customer signature</div><div className="signature-line signature-tall" /></div>
            <div><div style={fieldLabel}>Place / city</div><div className="signature-line signature-tall" /></div>
          </div>
        </section>

        <footer>
          <div>FICONTER Vault Assisted Recovery</div>
          <div>{document.document_id} · {request.reference}</div>
        </footer>
      </article>

      <style>{`
        .consent-shell {
          width: 100%;
          max-width: 860px;
          margin: 24px auto 56px;
          padding: 0 20px;
          box-sizing: border-box;
        }
        .print-action {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 12px;
        }
        .consent-document {
          width: 100%;
          box-sizing: border-box;
          background: #fff;
          color: #1f1f1f;
          padding: 34px 38px;
          border: 1px solid #d8d8d8;
          box-shadow: 0 8px 28px rgba(0,0,0,.06);
          font-family: Arial, Helvetica, sans-serif;
          font-size: 13px;
          line-height: 1.55;
        }
        .letterhead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 14px;
          border-bottom: 1px solid #222;
        }
        .brand-line {
          display: flex;
          align-items: center;
          gap: 11px;
        }
        .brand-name {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: .04em;
        }
        .confidential {
          margin-top: 2px;
          font-size: 9px;
          letter-spacing: .12em;
          color: #666;
        }
        .doc-ref {
          text-align: right;
          font-size: 10.5px;
          line-height: 1.55;
          color: #4a4a4a;
        }
        .title-block {
          padding: 24px 0 10px;
        }
        .title-block h1 {
          margin: 0;
          font-size: 20px;
          line-height: 1.25;
          font-weight: 700;
          color: #111;
        }
        .title-block p {
          margin: 6px 0 0;
          color: #555;
          font-size: 12.5px;
        }
        section {
          margin-top: 22px;
        }
        section h2 {
          margin: 0 0 9px;
          font-size: 14px;
          line-height: 1.3;
          color: #111;
          font-weight: 700;
        }
        section p {
          margin: 0 0 9px;
        }
        .field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px 24px;
          margin-top: 10px;
        }
        .consent-list {
          display: grid;
          gap: 10px;
          margin-top: 10px;
        }
        .consent-list label {
          display: grid;
          grid-template-columns: 16px 1fr;
          gap: 8px;
          align-items: start;
        }
        .box {
          width: 12px;
          height: 12px;
          border: 1px solid #333;
          display: inline-block;
          margin-top: 3px;
          box-sizing: border-box;
        }
        .signature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px 28px;
          margin-top: 18px;
        }
        .signature-line {
          height: 32px;
          border-bottom: 1px solid #555;
        }
        .signature-tall {
          height: 46px;
        }
        footer {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-top: 34px;
          padding-top: 10px;
          border-top: 1px solid #bbb;
          font-size: 9.5px;
          color: #666;
        }
        @media (max-width: 700px) {
          .consent-shell { padding: 0 10px; }
          .consent-document { padding: 24px 20px; }
          .letterhead { flex-direction: column; }
          .doc-ref { text-align: left; }
          .field-grid, .signature-grid { grid-template-columns: 1fr; }
        }
        @media print {
          @page { size: A4; margin: 12mm 14mm; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .consent-shell {
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .consent-document {
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            font-size: 11.5px !important;
          }
          .title-block { padding-top: 16px !important; }
          section { break-inside: avoid; margin-top: 16px !important; }
          footer { margin-top: 24px !important; }
        }
      `}</style>
    </main>
  );
}
