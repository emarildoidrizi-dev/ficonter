import type { Metadata } from "next";

import { PublicLegalPage, PublicLegalSection } from "@/components/PublicLegalPage";

export const metadata: Metadata = {
  title: "Cookies & Technology | Ficonter",
  description: "Information about cookies, local storage and similar technologies used by Ficonter.",
};

export default function CookiesPage() {
  return (
    <PublicLegalPage
      eyebrow="Technology transparency"
      title="Cookies & Technology"
      intro="FICONTER uses browser storage and similar technologies primarily to operate the service, protect accounts and remember user choices."
    >
      <PublicLegalSection title="1. Necessary technologies">
        <p>
          FICONTER may use cookies, local storage and comparable browser mechanisms for functions that are necessary or requested by the user, including authentication, session continuity, trusted-device handling, language selection, interface preferences, PWA behaviour and security controls.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="2. Authentication and security">
        <p>
          Authentication-related cookies and storage are used to maintain signed-in sessions, apply account-security settings and support recovery or trusted-device features. Disabling these technologies can prevent important account functions from working correctly.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="3. Preferences">
        <p>
          FICONTER stores user-selected settings such as language, appearance, density and certain workspace-interface preferences so the requested configuration can be restored on later visits.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="4. Advertising and optional tracking">
        <p>
          FICONTER is designed without advertising on the platform. The current public landing page does not intentionally rely on advertising cookies. Optional analytics, marketing or other non-essential tracking should only be introduced after the required consent mechanism and legal notices are in place.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="5. Consent standard">
        <p>
          Under German law, storing or accessing information on a user&apos;s device generally requires consent unless the technology is strictly necessary to transmit a communication or to provide a digital service expressly requested by the user. FICONTER&apos;s implementation should continue to follow that distinction when new technologies are added.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="6. Managing browser data">
        <p>
          Users can remove cookies and local storage through their browser or device settings. Removing required authentication or preference data may sign the user out, reset settings or disable functions until the required information is stored again.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="7. Future changes">
        <p>
          If FICONTER introduces analytics, marketing, embedded media or another optional technology that changes the legal basis or consent requirements, this page and the Privacy Policy will be updated before that technology is enabled for users.
        </p>
      </PublicLegalSection>
    </PublicLegalPage>
  );
}
