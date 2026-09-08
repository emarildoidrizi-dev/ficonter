import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  CircleDollarSign,
  Database,
  EyeOff,
  FileChartColumnIncreasing,
  FolderLock,
  Gauge,
  Landmark,
  Layers3,
  LockKeyhole,
  PiggyBank,
  ReceiptText,
  Repeat2,
  ShieldCheck,
  Target,
  TrendingUp,
  UserRoundCheck,
  Users,
  WalletCards,
} from "lucide-react";

import { Brand } from "@/components/Brand";
import { LanguageSelector } from "@/components/LanguageSelector";

import footerStyles from "../../landing-footer.module.css";
import styles from "./page.module.css";

type DetailPoint = {
  icon: LucideIcon;
  title: string;
  copy: string;
};

type DetailStep = {
  label: string;
  title: string;
  copy: string;
};

type DetailPage = {
  slug: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  lead: string;
  thesis: string;
  points: DetailPoint[];
  steps: DetailStep[];
  calloutTitle: string;
  calloutCopy: string;
};

const detailPages: Record<string, DetailPage> = {
  "private-workspace": {
    slug: "private-workspace",
    icon: LockKeyhole,
    eyebrow: "Privacy & account control",
    title: "Your financial workspace stays yours.",
    lead: "FICONTER is structured around authenticated, isolated workspaces so your financial records stay attached to the account and context they belong to.",
    thesis: "Privacy is not a single switch. It is part of how FICONTER organises access, records and financial contexts.",
    points: [
      {
        icon: UserRoundCheck,
        title: "Authenticated access",
        copy: "Private areas are tied to signed-in sessions, so workspace access begins with your FICONTER account.",
      },
      {
        icon: Database,
        title: "Account-level isolation",
        copy: "Database access policies are designed to keep each customer's records separated from other customer accounts.",
      },
      {
        icon: FolderLock,
        title: "Personal and business separation",
        copy: "Personal and business records can remain in distinct workspaces, reducing the risk of mixing financial contexts.",
      },
      {
        icon: EyeOff,
        title: "No advertising model",
        copy: "FICONTER is built without advertising and without selling financial data as part of the product model.",
      },
      {
        icon: Repeat2,
        title: "Deliberate workspace switching",
        copy: "Moving between personal and business is an explicit action, so the user always knows which financial context is active.",
      },
      {
        icon: ShieldCheck,
        title: "Data and privacy controls",
        copy: "Account settings provide a dedicated place for privacy, account and data-management preferences.",
      },
    ],
    steps: [
      {
        label: "01",
        title: "Sign in",
        copy: "Access begins through your authenticated FICONTER account.",
      },
      {
        label: "02",
        title: "Work in context",
        copy: "Your records are shown inside the workspace they belong to.",
      },
      {
        label: "03",
        title: "Switch intentionally",
        copy: "Move to another workspace only when you choose to change financial context.",
      },
    ],
    calloutTitle: "Privacy that supports clarity.",
    calloutCopy: "A private workspace is useful because it keeps financial information both protected and understandable. Separation is not only a security concern; it also prevents unrelated records from distorting the picture you are trying to manage.",
  },
  "financial-picture": {
    slug: "financial-picture",
    icon: CircleDollarSign,
    eyebrow: "Financial clarity",
    title: "See the whole financial picture, not just a balance.",
    lead: "FICONTER brings daily movement, obligations, reserves, debt, goals and financial indicators into one structured view so you can understand what is happening and what deserves attention.",
    thesis: "A balance tells you what exists at one moment. A financial picture explains how the pieces relate.",
    points: [
      {
        icon: WalletCards,
        title: "Income and spending",
        copy: "Track the movement of money across the month so inflows and outflows have context.",
      },
      {
        icon: ReceiptText,
        title: "Bills and commitments",
        copy: "See what is already spoken for before treating the remaining amount as truly available.",
      },
      {
        icon: PiggyBank,
        title: "Savings and reserves",
        copy: "Follow money set aside for resilience, planned goals and future priorities.",
      },
      {
        icon: Landmark,
        title: "Debt and credit obligations",
        copy: "Keep repayment responsibilities visible alongside the rest of the monthly plan.",
      },
      {
        icon: Target,
        title: "Goals and wealth direction",
        copy: "Connect short-term decisions with longer-term objectives instead of viewing them as separate problems.",
      },
      {
        icon: Gauge,
        title: "Financial intelligence",
        copy: "Structured indicators can surface financial health, cash-flow position, reserve progress and areas that may need attention.",
      },
    ],
    steps: [
      {
        label: "01",
        title: "Record",
        copy: "Add the financial activity and obligations that matter to your plan.",
      },
      {
        label: "02",
        title: "Structure",
        copy: "FICONTER groups the information into meaningful financial contexts.",
      },
      {
        label: "03",
        title: "Understand",
        copy: "Indicators and summaries turn individual numbers into a usable picture.",
      },
      {
        label: "04",
        title: "Decide",
        copy: "Use that picture to prioritise the next action with better context.",
      },
    ],
    calloutTitle: "Control, not noise.",
    calloutCopy: "FICONTER is designed to organise financial information and surface signals. It does not replace professional financial, investment, tax or legal advice.",
  },
  "personal-business": {
    slug: "personal-business",
    icon: Layers3,
    eyebrow: "Personal & business architecture",
    title: "Two financial worlds. One control center. No unnecessary mixing.",
    lead: "FICONTER lets you manage personal and business finances through one account while keeping the records, metrics and day-to-day decisions of each workspace distinct.",
    thesis: "The advantage is not combining everything into one ledger. It is making both contexts accessible without confusing one for the other.",
    points: [
      {
        icon: Users,
        title: "One account, distinct workspaces",
        copy: "Access personal and business environments through one FICONTER identity while preserving separate financial contexts.",
      },
      {
        icon: WalletCards,
        title: "Personal planning",
        copy: "Use the personal workspace for household cash flow, obligations, savings, debt and goals.",
      },
      {
        icon: BriefcaseBusiness,
        title: "Business operations",
        copy: "Use the business workspace for revenue, operating costs, inventory, suppliers and reporting.",
      },
      {
        icon: Repeat2,
        title: "Instant context switching",
        copy: "Move between workspaces without signing into a separate product or rebuilding your working context.",
      },
      {
        icon: FileChartColumnIncreasing,
        title: "Cleaner interpretation",
        copy: "Personal spending does not need to distort business metrics, and business activity does not need to distort household planning.",
      },
      {
        icon: TrendingUp,
        title: "Room to grow",
        copy: "The structure can support someone managing only personal finances today and adding business needs when their financial life expands.",
      },
    ],
    steps: [
      {
        label: "01",
        title: "Choose the workspace",
        copy: "Start in the financial context you intend to manage.",
      },
      {
        label: "02",
        title: "Manage the right records",
        copy: "Use the tools and metrics that belong to that personal or business context.",
      },
      {
        label: "03",
        title: "Switch when needed",
        copy: "Change workspaces deliberately while keeping each set of records organised.",
      },
    ],
    calloutTitle: "Together where useful. Separate where necessary.",
    calloutCopy: "FICONTER treats personal and business finance as connected parts of the same life, but not as interchangeable records. That distinction is what makes one-system access practical.",
  },
};

const relatedCopy: Record<string, string> = {
  "private-workspace": "Understand how FICONTER keeps account data and financial contexts separated.",
  "financial-picture": "See how FICONTER turns multiple financial signals into one usable picture.",
  "personal-business": "See how one account can support personal and business workspaces without mixing the records.",
};

export function generateStaticParams() {
  return Object.keys(detailPages).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = detailPages[slug];

  if (!page) return {};

  return {
    title: `${page.title} | FICONTER`,
    description: page.lead,
    alternates: {
      canonical: `/why/${page.slug}`,
    },
  };
}

export default async function WhyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = detailPages[slug];

  if (!page) notFound();

  const HeroIcon = page.icon;
  const relatedPages = Object.values(detailPages).filter((item) => item.slug !== page.slug);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand />
          <div className={styles.headerActions}>
            <nav className={styles.navigation} aria-label="Public navigation">
              <Link href="/#platform">Platform</Link>
              <Link href="/#for-you">Personal & Business</Link>
              <Link href="/#privacy">Privacy</Link>
              <Link className={styles.loginLink} href="/login?entry=brand">Log in</Link>
              <Link className={styles.headerCta} href="/register">Start free</Link>
            </nav>
            <div className={styles.headerLanguage}>
              <LanguageSelector variant="public" />
            </div>
          </div>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <Link className={styles.backLink} href="/">
            <ArrowLeft size={16} aria-hidden="true" /> Back to FICONTER
          </Link>
          <div className={styles.eyebrow}>{page.eyebrow}</div>
          <h1>{page.title}</h1>
          <p className={styles.heroLead}>{page.lead}</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/register">
              Start free <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className={styles.secondaryButton} href="/#platform">
              Explore the platform
            </Link>
          </div>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.heroOrb}><HeroIcon size={38} /></div>
          <div className={styles.heroVisualCopy}>
            <span>FICONTER</span>
            <strong>{page.thesis}</strong>
          </div>
          <div className={styles.signalGrid}>
            {page.points.slice(0, 4).map(({ icon: Icon, title }) => (
              <div key={title}>
                <Icon size={17} />
                <span>{title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.meaningSection}>
        <div className={styles.sectionIntro}>
          <div className={styles.eyebrow}>What this means in practice</div>
          <h2>{page.thesis}</h2>
        </div>

        <div className={styles.pointGrid}>
          {page.points.map(({ icon: Icon, title, copy }) => (
            <article className={styles.pointCard} key={title}>
              <div className={styles.pointIcon}><Icon size={21} /></div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.processSection}>
        <div className={styles.processIntro}>
          <div className={styles.eyebrow}>How it works</div>
          <h2>A structure that stays understandable.</h2>
          <p>FICONTER keeps the path from information to action deliberate, so the user can see what context they are working in and why a number matters.</p>
        </div>

        <div className={styles.stepList}>
          {page.steps.map((step) => (
            <article className={styles.stepCard} key={step.label}>
              <span>{step.label}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.calloutSection}>
        <div className={styles.calloutIcon}><Check size={24} /></div>
        <div>
          <div className={styles.eyebrow}>Why it matters</div>
          <h2>{page.calloutTitle}</h2>
          <p>{page.calloutCopy}</p>
        </div>
      </section>

      <section className={styles.relatedSection}>
        <div className={styles.relatedHeading}>
          <div>
            <div className={styles.eyebrow}>Related</div>
            <h2>Explore another part of FICONTER</h2>
          </div>
          <Link href="/#platform">Platform overview <ArrowRight size={17} /></Link>
        </div>

        <div className={styles.relatedGrid}>
          {relatedPages.map((item) => {
            const Icon = item.icon;
            return (
              <Link className={styles.relatedCard} href={`/why/${item.slug}`} key={item.slug}>
                <div className={styles.relatedIcon}><Icon size={20} /></div>
                <div>
                  <strong>{item.title}</strong>
                  <span>{relatedCopy[item.slug]}</span>
                </div>
                <ArrowUpRight className={styles.relatedArrow} size={18} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className={styles.finalSection}>
        <div>
          <div className={styles.eyebrow}>Financial Control Center</div>
          <h2>Bring your financial world into one considered system.</h2>
          <p>Start with a private workspace and build a clearer picture from there.</p>
        </div>
        <div className={styles.finalActions}>
          <Link className={styles.primaryButton} href="/register">
            Create your account <ArrowRight size={18} />
          </Link>
          <Link className={styles.secondaryButton} href="/">Back to FICONTER</Link>
        </div>
      </section>

      <footer className={footerStyles.footer}>
        <div className={footerStyles.identity}>
          <Brand />
          <p>Financial control for the life you are building.</p>
        </div>

        <nav className={footerStyles.navigation} aria-label="Footer navigation">
          <div>
            <span className={footerStyles.groupLabel}>Platform</span>
            <Link href="/#platform">Platform overview</Link>
            <Link href="/#for-you">Personal & Business</Link>
            <Link href="/#privacy">Privacy</Link>
          </div>
          <div>
            <span className={footerStyles.groupLabel}>Access</span>
            <Link href="/register">Start free</Link>
            <Link href="/login?entry=brand">Log in</Link>
          </div>
          <div>
            <span className={footerStyles.groupLabel}>Legal</span>
            <Link href="/impressum">Impressum</Link>
            <Link href="/datenschutz">Privacy Policy</Link>
            <Link href="/agb">Terms & Conditions</Link>
            <Link href="/widerruf">Withdrawal</Link>
            <Link href="/cookies">Cookies & Technology</Link>
          </div>
        </nav>

        <div className={footerStyles.bottom}>
          <span>© 2026 FICONTER. All rights reserved.</span>
          <span>FICONTER · Financial Control Center</span>
        </div>
      </footer>
    </main>
  );
}
