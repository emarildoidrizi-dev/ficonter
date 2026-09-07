import type { Metadata } from "next";

import { PublicLegalPage, PublicLegalSection } from "@/components/PublicLegalPage";
import { publicLegalIdentity } from "@/lib/legal/publicIdentity";

export const metadata: Metadata = {
  title: "Withdrawal Rights | Ficonter",
  description: "Consumer withdrawal information for Ficonter.",
};

export default function WithdrawalPage() {
  return (
    <PublicLegalPage
      eyebrow="Consumer information"
      title="Withdrawal Rights / Widerrufsbelehrung"
      intro="This information is prepared for future paid distance contracts with consumers. Paid production subscriptions are not yet treated as active at the current pre-launch stage."
    >
      <PublicLegalSection title="Right of withdrawal">
        <p>
          Where the statutory right of withdrawal applies, a consumer generally has fourteen days to withdraw from a distance contract without giving a reason. The withdrawal period generally begins when the contract is concluded, subject to the legally required information having been provided.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="How to exercise the right">
        <p>
          To exercise the right of withdrawal, the consumer must inform FICONTER of the decision to withdraw by an unequivocal statement, for example by email.
        </p>
        <p>
          Contact: <a href={`mailto:${publicLegalIdentity.email}`}>{publicLegalIdentity.email}</a>
        </p>
        <p>
          The provider&apos;s full legal name and service address will be inserted here before paid consumer contracts are enabled.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="Effects of withdrawal">
        <p>
          If a valid withdrawal is exercised, payments received under the withdrawn contract will be reimbursed in accordance with applicable law, generally using the same means of payment unless otherwise agreed and without charging the consumer a fee for the reimbursement.
        </p>
        <p>
          If a consumer expressly requests that a service begin during the withdrawal period, the consumer may owe the proportionate amount for the service already provided where the statutory requirements for such payment are met.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="Digital services and early performance">
        <p>
          Before any checkout flow is configured to affect or extinguish a statutory withdrawal right through early performance, FICONTER will obtain the confirmations and acknowledgements required by applicable consumer law and will provide the corresponding contractual confirmation.
        </p>
      </PublicLegalSection>

      <PublicLegalSection title="Model withdrawal form">
        <p>If you wish to withdraw, you may use the following wording, although use of the model is not mandatory:</p>
        <p>
          To FICONTER, {publicLegalIdentity.legalName}, {publicLegalIdentity.serviceAddress.join(", ")}, email {publicLegalIdentity.email}:
        </p>
        <p>
          I/We hereby give notice that I/We withdraw from my/our contract for the provision of the following service: __________.
        </p>
        <p>
          Ordered on / contract concluded on: __________<br />
          Name of consumer(s): __________<br />
          Address of consumer(s): __________<br />
          Date: __________<br />
          Signature (only if sent on paper): __________
        </p>
      </PublicLegalSection>
    </PublicLegalPage>
  );
}
