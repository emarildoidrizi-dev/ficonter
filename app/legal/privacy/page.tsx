import { LegalPageShell, legalStyles } from "@/components/LegalPageShell";
import { LEGAL_OPERATOR } from "@/lib/legal";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell eyebrow="Legal" title="Privacy Policy" showPrelaunchNotice>
      <section className={legalStyles.section}>
        <h2>1. Controller</h2>
        <p>The controller responsible for processing personal data through FICONTER is {LEGAL_OPERATOR.operatorName}, {LEGAL_OPERATOR.streetAddress}, {LEGAL_OPERATOR.cityCountry}. Legal/privacy contact: {LEGAL_OPERATOR.contactEmail}.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>2. What FICONTER processes</h2>
        <p>Depending on the features you use, FICONTER may process account identity and authentication data, profile information, financial records you enter or import, business-workspace records, preferences, support communications, subscription and billing metadata, security and audit information, and technical information necessary to operate and secure the service.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>3. Purposes and legal bases</h2>
        <ul>
          <li>Providing your account and requested FICONTER features: performance of a contract or steps requested before entering a contract.</li>
          <li>Protecting accounts, preventing abuse, maintaining service integrity and necessary operational logging: legitimate interests in secure and reliable operation.</li>
          <li>Billing, invoicing, accounting and legally required records: performance of a contract and compliance with legal obligations.</li>
          <li>Support requests and communications: performance of the service, legitimate interests, or consent where required.</li>
          <li>Optional technologies or communications that legally require consent are processed only where that consent has been obtained.</li>
        </ul>
      </section>
      <section className={legalStyles.section}>
        <h2>4. Service providers and recipients</h2>
        <p>FICONTER uses specialist infrastructure and service providers where necessary to operate the platform. These may include hosting/deployment, database and authentication, email delivery, workspace email, and payment-processing providers. Access is limited to what is necessary for the relevant service. A current production vendor list and applicable data-processing terms should be maintained as part of FICONTER&apos;s compliance records.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>5. International transfers</h2>
        <p>Where a provider processes personal data outside the European Economic Area, FICONTER will rely on an applicable transfer mechanism such as an adequacy decision or appropriate safeguards, including standard contractual clauses where required.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>6. Retention</h2>
        <p>Personal data is kept only for as long as required for the relevant purpose, account relationship, security need, or legal retention obligation. Customer-controlled financial data can be deleted through FICONTER&apos;s Data & Privacy controls. Account deletion removes customer-owned account data subject to lawful retention requirements and preservation of records that must remain for other users or legal compliance.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>7. Your rights</h2>
        <p>Subject to the conditions of applicable law, you may have rights of access, rectification, erasure, restriction, portability, objection, and withdrawal of consent. You also have the right to lodge a complaint with a competent data-protection supervisory authority.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>8. Security</h2>
        <p>FICONTER uses authenticated access, database-level access controls, transport security and other technical and organisational safeguards designed to protect account data. No internet service can guarantee absolute security.</p>
      </section>
      <section className={legalStyles.section}>
        <h2>9. Changes</h2>
        <p>This policy may be updated when FICONTER changes its services, providers or legal obligations. Material changes will be communicated where required.</p>
      </section>
    </LegalPageShell>
  );
}
