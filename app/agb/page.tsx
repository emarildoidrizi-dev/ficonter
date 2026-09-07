import type { Metadata } from "next";

import { PublicLegalPage, PublicLegalSection } from "@/components/PublicLegalPage";
import { publicLegalIdentity } from "@/lib/legal/publicIdentity";

export const metadata: Metadata = {
  title: "Terms & Conditions | Ficonter",
  description: "Terms governing use of Ficonter.",
};

export default function TermsPage() {
  return (
    <PublicLegalPage
      eyebrow="Terms of use"
      title="Terms & Conditions / AGB"
      intro="These terms govern access to and use of FICONTER. They are drafted for the current pre-launch and beta stage and must be reviewed again before paid consumer subscriptions are activated."
    >
      <PublicLegalSection title="1. Provider and scope">
        <p>
          FICONTER is provided by {publicLegalIdentity.legalName}. These terms apply to the public website, account registration, personal workspaces, business workspaces and related software functions supplied through FICONTER.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="2. Nature of the service">
        <p>
          FICONTER is software for organising, planning and reviewing financial information entered or connected by the user. It may calculate summaries, indicators, projections and financial-health insights from that information.
        </p>
        <p>
          FICONTER is not a bank, broker, investment adviser, tax adviser, debt adviser, insurance intermediary or credit provider. Product outputs are organisational and informational and do not replace professional advice where such advice is required.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="3. Accounts">
        <p>
          Users must provide accurate registration information, keep access credentials secure and use the account only in accordance with law and these terms. Users are responsible for activity carried out through their account unless the activity results from a security failure attributable to FICONTER.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="4. User data and financial records">
        <p>
          Users retain responsibility for the accuracy, completeness and legality of information they enter into FICONTER. The platform does not independently verify every financial figure, category, uploaded document or business record.
        </p>
        <p>
          Ownership of user-provided content remains with the user, subject to the limited processing necessary to provide, secure, maintain and improve the requested service in accordance with the Privacy Policy.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="5. Acceptable use">
        <p>Users must not:</p>
        <ul>
          <li>attempt to access another user&apos;s account or workspace;</li>
          <li>circumvent security, permission, subscription or access controls;</li>
          <li>upload unlawful, malicious or rights-infringing material;</li>
          <li>use automated methods that materially impair the service or its infrastructure;</li>
          <li>misrepresent FICONTER outputs as regulated financial, legal or tax advice.</li>
        </ul>
      </PublicLegalSection>

      <PublicLegalSection title="6. Availability, maintenance and changes">
        <p>
          FICONTER is designed for reliable operation, but uninterrupted availability cannot be guaranteed. Maintenance, security work, provider outages, software defects or events outside reasonable control may temporarily affect access. Material changes that adversely affect an active paid service will be handled in accordance with applicable consumer law and the terms presented at purchase.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="7. Beta and pre-launch use">
        <p>
          During beta or pre-launch testing, functions may be changed, limited or withdrawn as part of product development. Test data, fictional demonstration values and sandbox payment functions do not create an entitlement to a future paid plan or price.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="8. Paid subscriptions">
        <p>
          Paid production subscriptions are not considered active merely because billing code or sandbox integration exists. Before paid plans are enabled, FICONTER will present the applicable plan, price, billing interval, renewal terms, payment method and cancellation information before the user places an order.
        </p>
        <p>
          When a paid subscription is concluded, the checkout information and any plan-specific terms displayed at that time form part of the contract together with these terms.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="9. Cancellation and withdrawal rights">
        <p>
          Contract cancellation and statutory consumer withdrawal rights are separate. Where consumers have a statutory right of withdrawal for a distance contract, the applicable information and model form are provided on the Withdrawal page and, where legally required, during checkout.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="10. Intellectual property">
        <p>
          FICONTER&apos;s software, interface, branding, graphics, documentation and original platform content are protected by applicable intellectual-property law. Except where expressly permitted, users may not copy, reverse engineer, redistribute or commercially exploit protected parts of the service.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="11. Liability">
        <p>
          Statutory liability remains unaffected where liability cannot legally be excluded or limited, including liability for intent, gross negligence, injury to life, body or health, and liability under mandatory product-liability rules. Any further limitation for ordinary negligence will only apply to the extent permitted by German law and, for essential contractual obligations, subject to the legally permissible standard of foreseeable damage.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="12. Termination and account closure">
        <p>
          Users may close their account using available account controls or by contacting FICONTER. FICONTER may suspend or terminate access where necessary for security, unlawful use, serious breach of these terms or another legally justified reason. Mandatory retention duties may continue after account closure.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="13. Governing law and mandatory consumer rights">
        <p>
          German law applies subject to mandatory consumer-protection rules that cannot be displaced by contract. If a consumer habitually resides in another country, mandatory protections of that country remain unaffected where applicable.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="14. Contact">
        <p>
          Questions about these terms can be sent to <a href={`mailto:${publicLegalIdentity.email}`}>{publicLegalIdentity.email}</a>.
        </p>
      </PublicLegalSection>
    </PublicLegalPage>
  );
}
