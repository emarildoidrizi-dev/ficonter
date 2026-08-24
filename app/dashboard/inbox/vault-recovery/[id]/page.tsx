import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { getCustomerRecoveryConsent } from "@/lib/admin/vaultRecoveryInbox";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDateTime(value: string | null) {
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

export default async function CustomerVaultRecoveryConsentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const data = await getCustomerRecoveryConsent({ recoveryRequestId: id, userId: user.id }).catch(() => null);
  if (!data) notFound();

  const { request, document } = data;
  const address = [
    request.customer_address_line1,
    request.customer_address_line2,
    [request.customer_postal_code, request.customer_city].filter(Boolean).join(" "),
    request.country_region,
  ].filter(Boolean).join(", ");

  return (
    <main style={{ width: "min(900px,calc(100% - 28px))", margin: "28px auto 56px" }}>
      <article style={{ border: "1px solid rgba(120,120,120,.18)", borderRadius: 20, padding: "clamp(20px,4vw,34px)", background: "rgba(255,255,255,.5)", color: "inherit" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", paddingBottom: 16, borderBottom: "1px solid rgba(120,120,120,.28)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <Image src="/ficonter-mark.svg" alt="FICONTER emblem" width={42} height={42} />
            <div>
              <strong style={{ fontSize: 18, letterSpacing: ".04em" }}>FICONTER</strong>
              <div style={{ fontSize: 10, opacity: .6, letterSpacing: ".1em" }}>CONFIDENTIAL CUSTOMER AUTHORIZATION</div>
            </div>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.7 }}>
            <div><strong>Document ID:</strong> {document.document_id}</div>
            <div><strong>Recovery request:</strong> {request.reference}</div>
            <div><strong>Sent to you:</strong> {formatDateTime(document.sent_to_customer_at)}</div>
            {document.customer_signed_at ? <div><strong>Signed & submitted:</strong> {formatDateTime(document.customer_signed_at)}</div> : null}
          </div>
        </header>

        <section style={{ padding: "24px 0 8px" }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>Vault Assisted Recovery Consent & Authorization</h1>
          <p style={{ margin: "8px 0 0", opacity: .72 }}>This document records your authorization for FICONTER to process this specific last-resort Vault recovery request.</p>
        </section>

        <section style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 16 }}>1. Customer information</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
            {[
              ["Customer full name", request.customer_name || "Not provided"],
              ["Registered FICONTER email", request.customer_email],
              ["FICONTER account / user ID", request.user_id],
              ["Recovery request ID", request.reference],
              ["Country / region", request.country_region || "Not provided"],
              ["City", request.customer_city || "Not provided"],
              ["Residential address", address || "Not provided"],
            ].map(([label, value]) => (
              <div key={label} style={{ borderBottom: "1px solid rgba(120,120,120,.18)", padding: "10px 0" }}>
                <div style={{ fontSize: 10, fontWeight: 750, opacity: .55, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
                <div style={{ marginTop: 4, fontSize: 13, overflowWrap: "anywhere" }}>{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16 }}>2. Customer declaration</h2>
          <p>I confirm that I am requesting assistance because I cannot regain access to my FICONTER Vault using the normal recovery methods available to me.</p>
          <p>I understand that this process is limited to restoring access to my Vault and does not authorize FICONTER personnel to inspect, use, copy, export, or otherwise access my decrypted financial records except to the extent strictly required by the approved recovery process.</p>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16 }}>3. Mandatory consent and authorization</h2>
          <p>By electronically signing and submitting this document, I confirm all of the following:</p>
          <ul style={{ lineHeight: 1.7 }}>
            <li>I authorize FICONTER to process this specific Assisted Recovery request.</li>
            <li>My normal recovery methods have failed or are no longer available to me.</li>
            <li>I understand that a previous recovery credential may be invalidated and replaced after successful recovery.</li>
            <li>I have read and understood FICONTER&apos;s Security & Data Protection Commitment.</li>
          </ul>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16 }}>4. Security & data protection commitment</h2>
          <p>FICONTER is designed to protect customer financial information through strong encryption and strict access controls. Assisted Recovery is intended only to restore customer access to the Vault.</p>
          <p>FICONTER will not sell, rent, trade, monetize, distribute, or disclose customer financial data to third parties for advertising, marketing, profiling, data-brokerage, or unrelated commercial purposes. Any disclosure required by applicable law will be limited to what the law requires.</p>
        </section>

        <section style={{ marginTop: 24, padding: 16, borderRadius: 14, border: "1px solid rgba(120,120,120,.18)", background: "rgba(120,120,120,.05)" }}>
          <strong>{document.customer_signed_at ? "Document signed" : "Signature step not yet completed"}</strong>
          <p style={{ margin: "6px 0 0", fontSize: 13, opacity: .7 }}>
            {document.customer_signed_at
              ? `FICONTER recorded the signed document on ${formatDateTime(document.customer_signed_at)}.`
              : "The electronic signature control will appear here once the next recovery infrastructure step is deployed."}
          </p>
        </section>
      </article>
    </main>
  );
}
