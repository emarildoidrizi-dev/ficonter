"use client";

import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  ChevronRight,
  CircleHelp,
  CreditCard,
  FileKey2,
  Goal,
  Landmark,
  MessageSquareText,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { OPEN_CONTACT_EVENT } from "@/lib/support";
import styles from "./HelpCenter.module.css";

const guides = [
  {
    icon: ArrowLeftRight,
    title: "Transactions",
    description:
      "Record income and expenses, edit details, remove entries and understand EUR conversion.",
    points: [
      "Use General Income or General Expenses for every entry.",
      "The original currency and local transaction time remain attached to the record.",
      "Linked modules update automatically after a saved change.",
    ],
  },
  {
    icon: ReceiptText,
    title: "Bills and commitments",
    description:
      "Organize bills, mark them paid and understand how committed outflows affect cash flow.",
    points: [
      "Marking a bill paid creates the linked expense transaction.",
      "Debt payments should be recorded from the Debt module.",
      "Upcoming commitments feed the Cash Flow Intelligence view.",
    ],
  },
  {
    icon: WalletCards,
    title: "Planner and savings",
    description:
      "Plan the month, monitor available capital and keep general savings separate from goals.",
    points: [
      "The Monthly Planner summarizes income, expenses, savings, debt and goals.",
      "General Savings is driven by savings transactions.",
      "Goal contributions belong inside the Goals module.",
    ],
  },
  {
    icon: Goal,
    title: "Goals and debt",
    description:
      "Track progress, record investments and payments, and keep every movement synchronized.",
    points: [
      "Use Record Investment for a goal contribution.",
      "Use Record Payment for a debt reduction.",
      "The linked transaction and planner values update from the same source of truth.",
    ],
  },
  {
    icon: Landmark,
    title: "Net worth and independence",
    description:
      "Understand your current position, growth history and progress toward financial independence.",
    points: [
      "Net Worth combines recorded assets and liabilities.",
      "Growth conclusions require enough historical movement.",
      "Financial Independence scenarios depend on verified FICONTER inputs and your assumptions.",
    ],
  },
  {
    icon: ChartNoAxesCombined,
    title: "Scores and Smart Insights",
    description:
      "See how FICONTER interprets financial health without inventing values for empty accounts.",
    points: [
      "Financial Health and Wealth Score use different verified factors.",
      "Empty accounts remain Not assessed until meaningful data exists.",
      "Smart Insights uses FICONTER calculations only and makes no external AI request.",
    ],
  },
] as const;

const frequentlyAsked = [
  {
    question: "Why is a score shown as Not assessed?",
    answer:
      "FICONTER waits for meaningful financial records before evaluating your position. This prevents empty accounts from receiving false positive or negative conclusions.",
  },
  {
    question: "Does an administrator see my financial values?",
    answer:
      "No. Administration is privacy-safe and does not display customer balances, transactions, bills, debts, savings, goals or planner amounts.",
  },
  {
    question: "Why did another module change after I saved something?",
    answer:
      "Connected modules use shared data and calculations. A transaction, bill payment, debt payment or goal contribution can therefore update several views immediately.",
  },
  {
    question: "Can I use Enter instead of clicking a button?",
    answer:
      "Yes. Focus a button, select or form action with the keyboard and press Enter. Textareas keep Enter available for new lines.",
  },
] as const;

export function HelpCenter() {
  function openContact() {
    window.dispatchEvent(new Event(OPEN_CONTACT_EVENT));
  }

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span>PRIVATE SUPPORT CENTER</span>
          <h1>Help Center</h1>
          <p>
            Practical guidance for using FICONTER’s financial workspace, Wealth
            Engine and privacy controls.
          </p>
        </div>
        <div className={styles.heroBadge}>
          <CircleHelp size={19} aria-hidden="true" />
          In-app guidance
        </div>
      </header>

      <div className={styles.quickGrid}>
        <article>
          <ShieldCheck size={21} aria-hidden="true" />
          <span>Privacy first</span>
          <strong>Your financial values remain private.</strong>
        </article>
        <article>
          <FileKey2 size={21} aria-hidden="true" />
          <span>One source of truth</span>
          <strong>Connected modules stay synchronized.</strong>
        </article>
        <article>
          <CreditCard size={21} aria-hidden="true" />
          <span>Private development</span>
          <strong>Commercial payments remain disabled.</strong>
        </article>
      </div>

      <div className={styles.sectionHeading}>
        <div>
          <span>PRODUCT GUIDES</span>
          <h2>Find the right workspace</h2>
        </div>
        <p>
          Each guide explains what the module controls and how it connects to
          the rest of FICONTER.
        </p>
      </div>

      <div className={styles.guideGrid}>
        {guides.map(({ icon: Icon, title, description, points }) => (
          <article className={styles.guideCard} key={title}>
            <div className={styles.guideIcon}>
              <Icon size={20} aria-hidden="true" />
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
            <ul>
              {points.map((point) => (
                <li key={point}>
                  <ChevronRight size={14} aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className={styles.faqLayout}>
        <div className={styles.sectionHeadingCompact}>
          <span>COMMON QUESTIONS</span>
          <h2>Frequently asked</h2>
          <p>
            Clear answers to the questions most likely to appear while testing
            the platform.
          </p>
        </div>
        <div className={styles.faqList}>
          {frequentlyAsked.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>

      <article className={styles.contactCard}>
        <div className={styles.contactIcon}>
          <MessageSquareText size={24} aria-hidden="true" />
        </div>
        <div>
          <span>STILL NEED HELP?</span>
          <h2>Tell us what is happening.</h2>
          <p>
            Open the secure Contact Us window, describe your concern and tell
            us which email address to use for the response.
          </p>
        </div>
        <button type="button" onClick={openContact}>
          Contact Us <ChevronRight size={17} aria-hidden="true" />
        </button>
      </article>
    </section>
  );
}
