import { LegalPageShell, legalStyles } from "@/components/LegalPageShell";
import { LEGAL_OPERATOR, LEGAL_SERVICE_NOTICE } from "@/lib/legal";

export default function TermsPage() {
  return (
    <LegalPageShell eyebrow="Legal" title="Terms of Service" showPrelaunchNotice>
      <section className={legalStyles.section}>
        <h2>1. Provider and scope</h2>
        <p>These Terms govern use of FICONTER, provided by {LEGAL_OPERATOR.operatorName}, {LEGAL_OPERATOR.cityCountry}. They apply to personal and business workspace features unless a separate written agreement applies.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>2. Nature of the service</h2>
        <p>{LEGAL_SERVICE_NOTICE}</p>
        <p>Figures, forecasts, scores, insights and planning outputs are software-generated organisational information based on data available to the platform. Users remain responsible for financial decisions and for verifying important information.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>3. Accounts</h2>
        <p>You must provide accurate registration information, protect your credentials and use FICONTER only through your own authorised account. You are responsible for activity performed through your account unless caused by FICONTER&apos;s breach of its obligations.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>4. Acceptable use</h2>
        <p>You may not misuse the service, attempt unauthorised access, interfere with security or availability, upload unlawful material, impersonate another person, or use FICONTER in a way that violates applicable law or another person&apos;s rights.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>5. Plans and payments</h2>
        <p>Where paid plans are offered, the price, billing interval, included features and renewal terms shown at checkout form part of the contract. Payment processing may be handled by an external payment provider. Mandatory consumer rights remain unaffected.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>6. Cancellation and account deletion</h2>
        <p>Subscription cancellation and account deletion are separate actions. Cancelling a paid plan does not automatically delete the FICONTER account or its data. Account deletion is available through the Data & Privacy controls. Where applicable, statutory cancellation and withdrawal rights take precedence over these Terms.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>7. User data and exports</h2>
        <p>You retain responsibility for the data you enter into FICONTER. FICONTER provides account-data export functions and deletion controls. Data handling is further described in the Privacy Policy.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>8. Availability and changes</h2>
        <p>FICONTER may maintain, secure and improve the service. Features may change where reasonably necessary for security, legal compliance, technical development or product improvement, subject to mandatory rights applicable to digital products and continuing contracts.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>9. Liability</h2>
        <p>Nothing in these Terms excludes liability that cannot legally be excluded. Otherwise, liability is determined by applicable law. FICONTER does not guarantee that user-entered data, third-party data, forecasts or planning assumptions are complete or suitable for a particular financial decision.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>10. Governing law</h2>
        <p>German law applies to the extent legally permitted. Mandatory consumer protections of the country in which a consumer habitually resides remain unaffected where applicable.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>11. Contact</h2>
        <p>Legal contact: {LEGAL_OPERATOR.contactEmail}.</p>
      </section>
    </LegalPageShell>
  );
}
