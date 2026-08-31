import { LegalPageShell, legalStyles } from "@/components/LegalPageShell";
import { LEGAL_OPERATOR } from "@/lib/legal";

export default function ImprintPage() {
  return (
    <LegalPageShell eyebrow="Legal" title="Impressum / Legal Notice" showPrelaunchNotice>
      <section className={legalStyles.section}>
        <h2>Information according to § 5 DDG</h2>
        <p><strong>{LEGAL_OPERATOR.operatorName}</strong><br />{LEGAL_OPERATOR.streetAddress}<br />{LEGAL_OPERATOR.cityCountry}</p>
      </section>
      <section className={legalStyles.section}>
        <h2>Contact</h2>
        <p>Email: {LEGAL_OPERATOR.contactEmail}<br />Website: {LEGAL_OPERATOR.website}</p>
      </section>
      <section className={legalStyles.section}>
        <h2>Register and tax information</h2>
        <p>If FICONTER is later operated through a registered company, commercial register number, register court, legal form, authorised representative and VAT identification number will be added here where legally applicable.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>Service clarification</h2>
        <p>FICONTER is a software platform for financial organisation and planning. It does not itself hold customer money, execute payments, provide credit, or provide regulated investment, tax or legal advice.</p>
      </section>
    </LegalPageShell>
  );
}
