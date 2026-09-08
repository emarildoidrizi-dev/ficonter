import type { Metadata } from "next";
import {
  EyeOff,
  FileKey2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Network,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { PublicInfoPage } from "@/components/PublicInfoPage";

export const metadata: Metadata = {
  title: "Privacy & Trust | FICONTER",
  description:
    "Learn how FICONTER approaches privacy, authenticated access, workspace isolation, data control and security for personal and business financial information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PublicInfoPage
      eyebrow="Privacy & trust"
      title="Your financial workspace should remain yours."
      lead="Financial information is deeply personal. FICONTER is designed around authenticated access, account-level separation and a business model that does not depend on advertising against a user's financial activity. Privacy is treated as part of the product architecture, not merely as a legal page."
      heroIcon={LockKeyhole}
      heroLabel="PRIVATE BY DESIGN"
      heroStatement="Access should be deliberate, records should stay separated and the user should remain in control of the financial information they choose to place in FICONTER."
      highlights={[
        {
          icon: UserCheck,
          title: "Authenticated access",
          copy: "Access to a FICONTER workspace begins with an authenticated user identity rather than an open or shared financial environment.",
        },
        {
          icon: ShieldCheck,
          title: "Workspace isolation",
          copy: "Database-level access policies are used so customers can access only the records associated with their own authorised context.",
        },
        {
          icon: EyeOff,
          title: "No advertising model",
          copy: "FICONTER is not designed around selling attention or building an advertising profile from a user's financial activity.",
        },
        {
          icon: Fingerprint,
          title: "User control",
          copy: "The platform is built so users decide what financial information enters their workspace and how they organise it.",
        },
      ]}
      sections={[
        {
          id: "data-control",
          eyebrow: "Data ownership & control",
          title: "FICONTER should organise your information—not take ownership of your financial life.",
          copy: "The product philosophy is based on direct user control. Users choose what they record, how they structure it and which personal or business workspace it belongs to. FICONTER does not require a bank connection simply to make the core planning system useful.",
          points: [
            {
              icon: Fingerprint,
              title: "You decide what enters",
              copy: "Financial information is added because the user chooses to record or manage it inside the platform.",
            },
            {
              icon: Network,
              title: "No mandatory bank connection",
              copy: "Core FICONTER planning and control tools can be used without granting the platform direct access to a user's banking relationship.",
            },
            {
              icon: FileKey2,
              title: "Separate financial contexts",
              copy: "Personal and business information can remain logically separated so one context does not become an unnecessary source of exposure for the other.",
            },
            {
              icon: EyeOff,
              title: "No advertising against your finances",
              copy: "The platform is not designed to monetise financial behaviour through targeted advertising.",
            },
          ],
        },
        {
          id: "security",
          eyebrow: "Security architecture",
          title: "Privacy needs technical enforcement behind the interface.",
          copy: "A trustworthy financial interface cannot rely only on visual separation. FICONTER uses authenticated sessions and database-level access controls so access rules remain part of the underlying system as well as the user experience.",
          points: [
            {
              icon: KeyRound,
              title: "Secure authentication",
              copy: "Account access is protected through the platform's authentication layer before private workspace data is made available.",
            },
            {
              icon: ShieldCheck,
              title: "Database-level access policies",
              copy: "Access restrictions are enforced at the data layer so records are not intended to become visible simply because a client interface requests them.",
            },
            {
              icon: LockKeyhole,
              title: "Private workspace boundaries",
              copy: "Personal customer records remain associated with the authorised workspace rather than being exposed as a shared application dataset.",
            },
            {
              icon: UserCheck,
              title: "Role-aware access",
              copy: "Administrative and workspace capabilities are separated by role so elevated controls are not treated as ordinary user functions.",
            },
          ],
        },
      ]}
      process={{
        eyebrow: "Trust model",
        title: "A simple principle: minimise unnecessary access."
        ,copy: "The privacy model is easier to understand when the flow is explicit: establish who is accessing the platform, determine which workspace they are authorised to use, enforce that boundary at the data layer and expose only the information needed for the requested function.",
        steps: [
          { title: "Authenticate", copy: "Confirm the user identity before private financial records become available." },
          { title: "Authorise", copy: "Determine which workspace, role and records that identity is permitted to access." },
          { title: "Enforce", copy: "Apply access policies at the database and application layers rather than relying only on hidden interface elements." },
          { title: "Present", copy: "Return the financial information needed for the user's current context without unnecessarily widening access." },
        ],
      }}
      callout={{
        eyebrow: "Legal information",
        title: "Product privacy and legal privacy serve different purposes.",
        copy: "This page explains the product principles behind FICONTER's approach to privacy and trust. The formal Privacy Policy, legal disclosures and data-protection information remain available separately through the Legal section of the website.",
      }}
    />
  );
}
