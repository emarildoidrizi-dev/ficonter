import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CircleHelp,
  KeyRound,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import { PublicSiteFooter } from "@/components/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";

import styles from "./PublicHelpPage.module.css";

const helpAreas = [
  {
    icon: WalletCards,
    title: "Understand the platform",
    copy: "See how personal and business workspaces, planning, wealth and financial intelligence fit together.",
    href: "/platform",
    action: "Explore the platform",
  },
  {
    icon: CircleHelp,
    title: "Read the full FAQ",
    copy: "Browse direct answers about how FICONTER works, privacy, business use, account access and platform boundaries.",
    href: "/faq",
    action: "Open FAQ",
  },
  {
    icon: ShieldCheck,
    title: "Privacy and security",
    copy: "Review FICONTER's privacy principles, workspace isolation, data control and security architecture.",
    href: "/privacy",
    action: "View privacy & trust",
  },
  {
    icon: KeyRound,
    title: "Account access",
    copy: "Log in to your workspace, recover account access or continue into the private Help Center after authentication.",
    href: "/login?entry=brand",
    action: "Go to account access",
  },
] as const;

const guidance = [
  {
    title: "Getting started",
    items: [
      "Create an account and choose the workspace you want to use.",
      "Start with your core financial records before relying on scores or projections.",
      "Use the Personal and Business areas as separate contexts for separate records.",
    ],
  },
  {
    title: "Managing money",
    items: [
      "Transactions are the foundation for income and expense activity.",
      "Bills, debt payments, savings and goals should be recorded in their dedicated modules.",
      "Connected views can update when the same financial movement affects more than one module.",
    ],
  },
  {
    title: "Using financial intelligence",
    items: [
      "Scores and insights depend on the financial data available in your workspace.",
      "An empty or incomplete account may remain Not assessed instead of receiving a misleading score.",
      "FICONTER guidance supports financial organization and decision-making; it does not replace regulated professional advice.",
    ],
  },
] as const;

export function PublicHelpPage() {
  return (
    <main className={styles.page}>
      <PublicSiteHeader />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>FICONTER HELP</div>
          <h1>Help should be available before you ever need to log in.</h1>
          <p>
            Use this public Help Center to understand the platform, find common answers,
            review privacy and security information, and reach the right account-access path.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/faq">
              Browse FAQ <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className={styles.secondaryButton} href="/platform">
              Explore FICONTER
            </Link>
          </div>
        </div>

        <div className={styles.heroPanel}>
          <div className={styles.heroIcon}>
            <CircleHelp size={30} aria-hidden="true" />
          </div>
          <div>
            <span>PUBLIC RESOURCE</span>
            <strong>Available to visitors, customers and anyone evaluating FICONTER.</strong>
          </div>
          <p>
            Account-specific support stays private after sign-in, while general product help
            remains open to everyone.
          </p>
        </div>
      </section>

      <section className={styles.supportSection}>
        <div className={styles.sectionIntro}>
          <div className={styles.eyebrow}>FIND THE RIGHT PLACE</div>
          <h2>Choose what you need help with.</h2>
          <p>
            Public guidance and private account support serve different purposes. These paths
            keep each request in the right place.
          </p>
        </div>

        <div className={styles.helpGrid}>
          {helpAreas.map(({ icon: Icon, title, copy, href, action }) => (
            <article className={styles.helpCard} key={title}>
              <div className={styles.cardIcon}>
                <Icon size={21} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <Link href={href}>
                {action} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.guidanceSection}>
        <div className={styles.guidanceIntro}>
          <BookOpenCheck size={24} aria-hidden="true" />
          <div>
            <div className={styles.eyebrow}>PRODUCT GUIDANCE</div>
            <h2>Start with the fundamentals.</h2>
            <p>
              These principles apply whether you are exploring FICONTER or already using your
              own workspace.
            </p>
          </div>
        </div>

        <div className={styles.guidanceGrid}>
          {guidance.map((group) => (
            <article key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.privateSupport}>
        <div className={styles.privateIcon}>
          <LockKeyhole size={25} aria-hidden="true" />
        </div>
        <div>
          <span>ACCOUNT-SPECIFIC SUPPORT</span>
          <h2>Already have a FICONTER account?</h2>
          <p>
            Sign in and open the private Help Center for workspace-specific guidance and secure
            support conversations linked to your account.
          </p>
        </div>
        <Link href="/login?entry=brand">
          <MessageSquareText size={17} aria-hidden="true" />
          Log in for private support
        </Link>
      </section>

      <PublicSiteFooter />
    </main>
  );
}
