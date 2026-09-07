import type { Metadata } from "next";

import { PublicLegalPage, PublicLegalSection } from "@/components/PublicLegalPage";
import { publicLegalIdentity } from "@/lib/legal/publicIdentity";

export const metadata: Metadata = {
  title: "Impressum | Ficonter",
  description: "Legal notice and provider information for Ficonter.",
};

export default function ImpressumPage() {
  return (
    <PublicLegalPage
      eyebrow="Legal information"
      title="Impressum / Legal Notice"
      intro="Provider information for FICONTER under the German Digital Services Act (Digitale-Dienste-Gesetz, DDG)."
    >
      <PublicLegalSection title="Provider">
        <address>
          <strong>{publicLegalIdentity.legalName}</strong><br />
          {publicLegalIdentity.brandName} · {publicLegalIdentity.descriptor}<br />
          {publicLegalIdentity.serviceAddress.map((line) => (
            <span key={line}>{line}<br /></span>
          ))}
          Germany
        </address>
        <p>Status: {publicLegalIdentity.registrationStatus}.</p>
      </PublicLegalSection>

      <PublicLegalSection title="Contact">
        <p>
          Email: <a href={`mailto:${publicLegalIdentity.email}`}>{publicLegalIdentity.email}</a>
        </p>
        <p>
          FICONTER also provides authenticated support channels inside the platform for account-related requests.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="Register and tax information">
        <p>
          No commercial-register entry, VAT identification number or economic identification number is published at this pre-registration stage. If any of those identifiers are issued, this notice will be updated before commercial launch.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="Responsible for content">
        <p>
          Responsibility for the content of this digital service remains with the legal operator identified above. FICONTER is a software platform for organising financial information and does not present the landing-page demo figures as customer records.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="Consumer dispute resolution">
        <p>
          The final statement on participation in consumer dispute-resolution proceedings will be fixed before paid consumer subscriptions are activated. FICONTER does not currently link to the discontinued EU Online Dispute Resolution platform.
        </p>
      </PublicLegalSection>
    </PublicLegalPage>
  );
}
