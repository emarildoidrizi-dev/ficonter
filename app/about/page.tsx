import type { Metadata } from "next";
import {
  Compass,
  Eye,
  Layers3,
  Lightbulb,
  LockKeyhole,
  Route,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import { PublicInfoPage } from "@/components/PublicInfoPage";

export const metadata: Metadata = {
  title: "About FICONTER",
  description:
    "Learn why FICONTER exists, what Financial Control Center means and the product philosophy behind a private, structured system for personal and business finance.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <PublicInfoPage
      eyebrow="About FICONTER"
      title="Built for people who want to understand their money, not surrender control of it."
      lead="FICONTER means Financial Control Center. It was created around a straightforward idea: a person's financial life should make sense in one place. Instead of adding more disconnected tools, FICONTER aims to give financial activity structure, context and direction."
      heroIcon={Compass}
      heroLabel="FINANCIAL CONTROL CENTER"
      heroStatement="Record what matters. Structure it clearly. Understand the position. Decide what comes next."
      highlights={[
        {
          icon: Lightbulb,
          title: "A simple starting idea",
          copy: "Financial information is often spread across balances, bills, notes, spreadsheets and separate applications. FICONTER brings the important parts into one structured system.",
        },
        {
          icon: Layers3,
          title: "Personal and business",
          copy: "The same person may manage household finances and a business. FICONTER keeps both close without pretending they belong in the same ledger.",
        },
        {
          icon: LockKeyhole,
          title: "Control before connectivity",
          copy: "The platform is built to be useful without requiring users to hand over direct access to every financial relationship they have.",
        },
        {
          icon: Sparkles,
          title: "Clarity over noise",
          copy: "Features are intended to reduce financial confusion and surface the information that matters instead of adding complexity for its own sake.",
        },
      ]}
      sections={[
        {
          id: "purpose",
          eyebrow: "Why FICONTER exists",
          title: "Financial information becomes valuable when it has context.",
          copy: "A balance alone cannot explain whether upcoming obligations are covered, whether reserves are adequate, whether debt is moving in the right direction or whether a goal is realistic. FICONTER exists to connect those questions inside one understandable financial picture.",
          points: [
            {
              icon: Eye,
              title: "See the position",
              copy: "Understand the current financial picture instead of relying on isolated numbers from separate sources.",
            },
            {
              icon: Target,
              title: "Give money direction",
              copy: "Connect spending, savings, obligations and goals so financial decisions have an explicit purpose.",
            },
            {
              icon: Route,
              title: "Follow the path",
              copy: "Use historical movement and structured indicators to understand whether the financial plan is improving or drifting.",
            },
            {
              icon: Users,
              title: "Fit real financial lives",
              copy: "Support people whose financial responsibilities may include both household planning and business operations.",
            },
          ],
        },
        {
          id: "philosophy",
          eyebrow: "Product philosophy",
          title: "The platform should strengthen the user's judgement, not replace it.",
          copy: "FICONTER is designed as a control center: it organises information, provides structure and surfaces signals. The user remains responsible for the financial decisions they make. That distinction keeps the product focused on clarity rather than pretending to be a bank, broker or personal financial adviser.",
          points: [
            {
              icon: ShieldCheck,
              title: "Private by design",
              copy: "Financial information deserves strong workspace boundaries, authenticated access and a product model that does not depend on advertising against user activity.",
            },
            {
              icon: Scale,
              title: "Clear role boundaries",
              copy: "FICONTER is a financial organisation and planning platform, not a substitute for regulated financial, investment, tax or legal advice.",
            },
            {
              icon: Compass,
              title: "User-directed control",
              copy: "Users choose what information they place in the system and use that structure to support their own financial priorities.",
            },
            {
              icon: Sparkles,
              title: "Continuous refinement",
              copy: "The product can evolve as financial needs change while preserving the core principles of clarity, privacy and deliberate control.",
            },
          ],
        },
      ]}
      process={{
        eyebrow: "The FICONTER approach",
        title: "A repeatable financial control cycle.",
        copy: "The product is organised around a sequence that can remain useful whether the user is managing a simple monthly plan or a more complex financial life.",
        steps: [
          { title: "Record", copy: "Bring the relevant financial activity, obligations and balances into the right workspace." },
          { title: "Structure", copy: "Organise information so bills, savings, debt, goals and business records keep their proper context." },
          { title: "Understand", copy: "Use summaries, dashboards and financial indicators to see how the pieces relate." },
          { title: "Plan & act", copy: "Choose the next financial action with a clearer picture of what it affects." },
        ],
      }}
      callout={{
        eyebrow: "Long-term direction",
        title: "FICONTER is intended to grow as the user's financial life grows.",
        copy: "The long-term vision is a financial control center that can remain useful from everyday personal planning through more complex business and wealth contexts, while keeping the interface understandable and the user in control of the information they choose to manage.",
      }}
    />
  );
}
