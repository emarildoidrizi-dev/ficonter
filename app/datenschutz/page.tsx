import type { Metadata } from "next";

import { PublicLegalPage, PublicLegalSection } from "@/components/PublicLegalPage";
import { publicLegalIdentity } from "@/lib/legal/publicIdentity";

export const metadata: Metadata = {
  title: "Privacy Policy | Ficonter",
  description: "Privacy information for Ficonter users.",
};

export default function PrivacyPolicyPage() {
  return (
    <PublicLegalPage
      eyebrow="Data protection"
      title="Privacy Policy / Datenschutzerklärung"
      intro="This notice explains how FICONTER processes personal data when you visit the public site, create an account, use a workspace, contact support or use subscription functions."
    >
      <PublicLegalSection title="1. Controller">
        <p>
          The controller under the General Data Protection Regulation (GDPR) is:
        </p>
        <address>
          <strong>{publicLegalIdentity.legalName}</strong><br />
          {publicLegalIdentity.serviceAddress.map((line) => (
            <span key={line}>{line}<br /></span>
          ))}
          Germany<br />
          Email: <a href={`mailto:${publicLegalIdentity.email}`}>{publicLegalIdentity.email}</a>
        </address>
      </PublicLegalSection>

      <PublicLegalSection title="2. Data processed">
        <p>Depending on the features you use, FICONTER may process:</p>
        <ul>
          <li>account and identity data such as email address, authentication status and profile settings;</li>
          <li>financial information you enter into personal or business workspaces, including transactions, bills, balances, goals, debts, savings, categories and planning records;</li>
          <li>business-workspace information such as revenue, costs, inventory, suppliers and related records;</li>
          <li>documents or files you choose to upload;</li>
          <li>support requests and communications;</li>
          <li>subscription, plan and payment-reference information where billing functions are used;</li>
          <li>technical, security and session information needed to operate and protect the service.</li>
        </ul>
      </PublicLegalSection>

      <PublicLegalSection title="3. Purposes and legal bases">
        <p>Personal data is processed primarily to:</p>
        <ul>
          <li>create and administer accounts and authenticate users;</li>
          <li>provide personal and business financial workspaces and requested platform functions;</li>
          <li>save preferences, language, theme and security settings;</li>
          <li>process support and account-security requests;</li>
          <li>operate subscription and billing functions when activated;</li>
          <li>maintain platform security, prevent misuse and investigate technical incidents;</li>
          <li>meet legal and accounting obligations where they apply.</li>
        </ul>
        <p>
          Depending on the processing activity, the legal basis may be Article 6(1)(b) GDPR for performance of a contract or pre-contractual measures, Article 6(1)(c) GDPR for legal obligations, Article 6(1)(f) GDPR for legitimate interests in secure and reliable operation, or Article 6(1)(a) GDPR where consent is specifically requested.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="4. Hosting, authentication and infrastructure">
        <p>
          FICONTER is deployed using Vercel infrastructure and uses Supabase for database, authentication, realtime and storage functions. These providers may process technical data and, where required for the service, account or workspace data on FICONTER&apos;s behalf under their applicable data-processing terms.
        </p>
        <p>
          Infrastructure locations and sub-processors can change over time. Where a provider processes personal data outside the European Economic Area, FICONTER will rely on an applicable GDPR transfer mechanism, such as an adequacy decision or appropriate contractual safeguards, where required.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="5. Payments">
        <p>
          The codebase contains PayPal subscription integration prepared for FICONTER plans. Paid production subscriptions are not treated as active merely because this integration exists. If a user chooses PayPal when paid plans are activated, PayPal processes payment and account information under its own privacy terms, while FICONTER stores the subscription identifiers and status needed to administer access.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="6. Exchange-rate data and external requests">
        <p>
          Currency-conversion functionality may request exchange-rate information from an external rate service. FICONTER is designed so the request is for rate data rather than the transmission of a user&apos;s full financial ledger. Technical connection data may nevertheless be processed by the external service when such a request is made.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="7. Cookies, local storage and device information">
        <p>
          FICONTER uses cookies and browser storage for functions such as authentication, language selection, interface preferences, trusted-device handling and service operation. These technologies are described in more detail on the Cookies & Technology page.
        </p>
        <p>
          FICONTER does not currently advertise on the platform. Optional analytics, marketing or advertising technologies should not be introduced without the required consent mechanism and an updated privacy notice.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="8. Retention">
        <p>
          Personal data is kept only for as long as required for the purpose for which it is processed, to provide the account or service, to meet statutory retention requirements, or to establish, exercise or defend legal claims. Account deletion may be subject to limited retention where a legal obligation requires certain records to be preserved.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="9. Your rights">
        <p>
          Subject to the conditions of the GDPR, you may have rights of access, rectification, erasure, restriction, data portability and objection. Where processing is based on consent, you may withdraw that consent for the future. You also have the right to lodge a complaint with a competent data-protection supervisory authority.
        </p>
        <p>
          Requests can be sent to <a href={`mailto:${publicLegalIdentity.email}`}>{publicLegalIdentity.email}</a>.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="10. Automated financial insights">
        <p>
          FICONTER may calculate scores, indicators and insights from information in a user&apos;s workspace to help organise and explain that user&apos;s financial position. These functions are informational product features. They are not intended to make legally binding decisions about a person or to determine access to credit, insurance, employment or another comparable service.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="11. Changes to this notice">
        <p>
          This policy will be updated when FICONTER&apos;s legal operator details, infrastructure, paid subscriptions, processing purposes or material product features change. The current version will remain available from the public footer.
        </p>
      </PublicLegalSection>
    </PublicLegalPage>
  );
}
