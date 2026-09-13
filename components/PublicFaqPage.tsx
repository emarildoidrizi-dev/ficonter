import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  ChevronDown,
  CreditCard,
  HelpCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { PublicSiteFooter } from "@/components/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { faqCategories, faqItems, type FaqCategoryId } from "@/lib/public-faq";

import styles from "./PublicFaqPage.module.css";

const categoryIcons = {
  about: HelpCircle,
  "how-it-works": WalletCards,
  intelligence: Sparkles,
  "savings-debt-credit": CreditCard,
  business: BriefcaseBusiness,
  "privacy-security": LockKeyhole,
  "access-support": ShieldCheck,
} satisfies Record<FaqCategoryId, typeof HelpCircle>;

export function PublicFaqPage() {
  return (
    <main className={styles.page}>
      <PublicSiteHeader />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>FICONTER FAQ</div>
          <h1>Questions worth answering clearly.</h1>
          <p>
            Straightforward answers about how FICONTER works, what it is designed to do,
            how financial information is handled and where the platform draws its boundaries.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/register">
              Start free <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className={styles.secondaryButton} href="/about">About FICONTER</Link>
          </div>
        </div>

        <div className={styles.heroPanel}>
          <div className={styles.heroPanelTop}>
            <div className={styles.heroIcon}><HelpCircle size={30} aria-hidden="true" /></div>
            <div>
              <span>Clear answers</span>
              <strong>Know what FICONTER does before you rely on it.</strong>
            </div>
          </div>
          <div className={styles.heroStats}>
            <div><strong>{faqItems.length}</strong><span>questions</span></div>
            <div><strong>{faqCategories.length}</strong><span>topics</span></div>
            <div><strong>1</strong><span>clear reference</span></div>
          </div>
          <div className={styles.heroAssurance}>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Includes direct answers to common concerns about privacy, bank access and business use.</span>
          </div>
        </div>
      </section>

      <section className={styles.topicSection}>
        <div className={styles.topicIntro}>
          <div className={styles.eyebrow}>Browse by topic</div>
          <h2>Find the part of FICONTER you want to understand.</h2>
          <p>Choose a topic to jump directly to its questions.</p>
        </div>
        <nav className={styles.topicGrid} aria-label="FAQ topics">
          {faqCategories.map((category) => {
            const Icon = categoryIcons[category.id];
            const count = faqItems.filter((item) => item.category === category.id).length;
            return (
              <a href={`#${category.id}`} key={category.id}>
                <div className={styles.topicIcon}><Icon size={19} aria-hidden="true" /></div>
                <div>
                  <strong>{category.label}</strong>
                  <span>{category.description}</span>
                </div>
                <small>{count}</small>
              </a>
            );
          })}
        </nav>
      </section>

      <section className={styles.faqSection}>
        <div className={styles.sectionIntro}>
          <div className={styles.eyebrow}>Answers</div>
          <h2>Frequently asked questions.</h2>
          <p>Open any question to read the full answer. You can keep more than one answer open while comparing topics.</p>
        </div>

        <div className={styles.groups}>
          {faqCategories.map((category) => {
            const Icon = categoryIcons[category.id];
            const items = faqItems.filter((item) => item.category === category.id);
            return (
              <section className={styles.group} id={category.id} key={category.id} aria-labelledby={`${category.id}-title`}>
                <div className={styles.groupHeading}>
                  <div className={styles.groupIcon}><Icon size={20} aria-hidden="true" /></div>
                  <div>
                    <span>{String(items.length).padStart(2, "0")} questions</span>
                    <h3 id={`${category.id}-title`}>{category.label}</h3>
                    <p>{category.description}</p>
                  </div>
                </div>

                <div className={styles.accordion}>
                  {items.map((item) => (
                    <details className={styles.faqItem} key={item.id}>
                      <summary>
                        <span>{item.question}</span>
                        <span className={styles.chevron}><ChevronDown size={18} aria-hidden="true" /></span>
                      </summary>
                      <div className={styles.answer}><p>{item.answer}</p></div>
                    </details>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className={styles.finalCta}>
        <div>
          <div className={styles.eyebrow}>Financial Control Center</div>
          <h2>Understand the platform. Then decide if it fits the way you manage money.</h2>
          <p>Start with a private workspace and build a clearer structure around the financial life you are managing.</p>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.primaryButton} href="/register">
            Create your account <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link className={styles.secondaryButton} href="/login?entry=brand">Log in</Link>
        </div>
      </section>

      <PublicSiteFooter />
    </main>
  );
}
