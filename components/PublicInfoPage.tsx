import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Check, CircleDot } from "lucide-react";

import { PublicSiteFooter } from "@/components/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";

import styles from "./PublicInfoPage.module.css";

type Highlight = {
  icon: LucideIcon;
  title: string;
  copy: string;
};

type DetailSection = {
  id?: string;
  eyebrow: string;
  title: string;
  copy: string;
  points: Array<{
    icon: LucideIcon;
    title: string;
    copy: string;
  }>;
};

type ProcessStep = {
  title: string;
  copy: string;
};

export type PublicInfoPageProps = {
  eyebrow: string;
  title: string;
  lead: string;
  heroIcon: LucideIcon;
  heroLabel: string;
  heroStatement: string;
  highlights: Highlight[];
  sections: DetailSection[];
  process?: {
    eyebrow: string;
    title: string;
    copy: string;
    steps: ProcessStep[];
  };
  callout?: {
    eyebrow: string;
    title: string;
    copy: string;
  };
};

export function PublicInfoPage({
  eyebrow,
  title,
  lead,
  heroIcon: HeroIcon,
  heroLabel,
  heroStatement,
  highlights,
  sections,
  process,
  callout,
}: PublicInfoPageProps) {
  return (
    <main className={styles.page}>
      <PublicSiteHeader />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>{eyebrow}</div>
          <h1>{title}</h1>
          <p>{lead}</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/register">
              Start free <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className={styles.secondaryButton} href="/">
              Back to homepage
            </Link>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.visualGlow} aria-hidden="true" />
          <div className={styles.heroIcon}><HeroIcon size={34} /></div>
          <div className={styles.heroVisualCopy}>
            <span>{heroLabel}</span>
            <strong>{heroStatement}</strong>
          </div>
          <div className={styles.visualSignals}>
            {highlights.slice(0, 4).map(({ icon: Icon, title }) => (
              <div key={title}><Icon size={16} /><span>{title}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.highlightSection}>
        <div className={styles.sectionIntroCenter}>
          <div className={styles.eyebrow}>At a glance</div>
          <h2>What this means inside FICONTER.</h2>
        </div>
        <div className={styles.highlightGrid}>
          {highlights.map(({ icon: Icon, title: itemTitle, copy }) => (
            <article className={styles.highlightCard} key={itemTitle}>
              <div className={styles.cardIcon}><Icon size={21} /></div>
              <h3>{itemTitle}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      {sections.map((section, sectionIndex) => (
        <section
          className={`${styles.detailSection} ${sectionIndex % 2 === 1 ? styles.detailSectionAlt : ""}`}
          id={section.id}
          key={section.title}
        >
          <div className={styles.detailIntro}>
            <div className={styles.eyebrow}>{section.eyebrow}</div>
            <h2>{section.title}</h2>
            <p>{section.copy}</p>
          </div>
          <div className={styles.detailGrid}>
            {section.points.map(({ icon: Icon, title: pointTitle, copy }) => (
              <article className={styles.detailCard} key={pointTitle}>
                <div className={styles.detailCardTop}>
                  <div className={styles.cardIcon}><Icon size={20} /></div>
                  <CircleDot size={15} aria-hidden="true" />
                </div>
                <h3>{pointTitle}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
      ))}

      {process ? (
        <section className={styles.processSection}>
          <div className={styles.processIntro}>
            <div className={styles.eyebrow}>{process.eyebrow}</div>
            <h2>{process.title}</h2>
            <p>{process.copy}</p>
          </div>
          <div className={styles.steps}>
            {process.steps.map((step, index) => (
              <article key={step.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><h3>{step.title}</h3><p>{step.copy}</p></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {callout ? (
        <section className={styles.callout}>
          <div className={styles.calloutMark}><Check size={24} /></div>
          <div>
            <div className={styles.eyebrow}>{callout.eyebrow}</div>
            <h2>{callout.title}</h2>
            <p>{callout.copy}</p>
          </div>
        </section>
      ) : null}

      <section className={styles.finalCta}>
        <div>
          <div className={styles.eyebrow}>Financial Control Center</div>
          <h2>Build a clearer financial system around your own life.</h2>
          <p>Start with a private workspace and grow from there as your financial needs become more complex.</p>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.primaryButton} href="/register">
            Create your account <ArrowRight size={18} />
          </Link>
          <Link className={styles.secondaryButton} href="/login?entry=brand">Log in</Link>
        </div>
      </section>

      <PublicSiteFooter />
    </main>
  );
}
