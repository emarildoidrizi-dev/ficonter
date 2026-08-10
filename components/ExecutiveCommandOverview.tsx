"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  CalendarDays,
  Compass,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { HorizonCommandStrip } from "@/components/HorizonCommandStrip";
import { formatCurrency } from "@/lib/financialOptions";
import { finiteNumber } from "@/lib/finance/money";
import type { FinancialGpsResult } from "@/lib/wealth/financialGps";
import styles from "./ExecutiveCommandOverview.module.css";

type ActivityPoint = {
  amount: number;
  income: boolean;
};

type Bill = {
  id: string;
  status: string;
  amount_eur: number | string;
  due_date: string;
};

type Props = {
  gps: FinancialGpsResult;
  income: number;
  expenses: number;
  savings: number;
  cashFlow: number;
  savingsRate: number;
  activity: ActivityPoint[];
  bills: Bill[];
};

function sparklinePath(activity: ActivityPoint[]) {
  const chronological = [...activity].reverse().slice(-22);
  const values = [0];
  let running = 0;

  for (const item of chronological) {
    running += item.income ? Math.abs(item.amount) : -Math.abs(item.amount);
    values.push(running);
  }

  if (values.length < 2) return "M 0 46 L 100 46";

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(1, maximum - minimum);

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 52 - ((value - minimum) / range) * 40;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function share(value: number, income: number) {
  if (income <= 0) return 0;
  return Math.max(0, Math.min(100, (value / income) * 100));
}

function formatDueDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function unpaidUpcomingBills(bills: Bill[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return bills
    .filter((bill) => {
      const status = String(bill.status || "").toLowerCase();
      if (["paid", "completed", "settled"].includes(status)) return false;
      const due = new Date(`${bill.due_date}T12:00:00`);
      return !Number.isNaN(due.getTime()) && due >= today;
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 3);
}

export function ExecutiveCommandOverview({
  gps,
  income,
  expenses,
  savings,
  cashFlow,
  savingsRate,
  activity,
  bills,
}: Props) {
  const path = sparklinePath(activity);
  const upcomingBills = unpaidUpcomingBills(bills);
  const expenseShare = share(expenses, income);
  const savingsShare = share(savings, income);
  const positive = cashFlow >= 0;
  const journeyProgress = Math.round(
    ((gps.stageIndex + 1) / Math.max(1, gps.stages.length)) * 100,
  );

  return (
    <div className={styles.root} aria-label="Executive Command Center overview">
      <HorizonCommandStrip gps={gps} />

      <section className={styles.primaryGrid}>
        <article className={styles.gpsHero}>
          <div className={styles.gpsCopy}>
            <span className={styles.eyebrow}>Financial GPS</span>
            <h2>{gps.primaryAction.title}</h2>
            <p>{gps.primaryAction.instruction}</p>

            <div className={styles.gpsMeta}>
              <span>{gps.confidenceLabel}</span>
              <span>{gps.stage.label} · Stage {gps.stageIndex + 1}</span>
            </div>

            <details className={styles.priorityDetails}>
              <summary>Why this is the priority</summary>
              <p>{gps.primaryAction.explanation}</p>
            </details>

            <Link href="/dashboard/gps" className={styles.primaryAction}>
              Open Financial GPS <ArrowRight size={17} />
            </Link>
          </div>

          <div className={styles.orbitVisual} aria-hidden="true">
            <span className={styles.orbitOne} />
            <span className={styles.orbitTwo} />
            <span className={styles.orbitThree} />
            <span className={styles.orbitFour} />
            <span className={styles.orbitDotOne} />
            <span className={styles.orbitDotTwo} />
            <span className={styles.orbitCore}>
              <Compass size={34} />
            </span>
          </div>
        </article>

        <article className={styles.cashCard}>
          <div className={styles.cardTopline}>
            <span>Recorded cash position</span>
            <span className={positive ? styles.positiveBadge : styles.negativeBadge}>
              {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {positive ? "Positive" : "Needs attention"}
            </span>
          </div>

          <strong className={styles.cashValue}>{formatCurrency(cashFlow, "EUR")}</strong>
          <p>Income minus all completed outflows recorded to date.</p>

          <div className={styles.sparkline} aria-hidden="true">
            <svg viewBox="0 0 100 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="executive-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="var(--gold)" />
                  <stop offset="1" stopColor="var(--sage)" />
                </linearGradient>
                <linearGradient id="executive-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--gold)" stopOpacity=".22" />
                  <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${path} L 100 60 L 0 60 Z`} fill="url(#executive-area)" />
              <path d={path} fill="none" stroke="url(#executive-line)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>

          <div className={styles.cashStats}>
            <span>
              <small>Recorded income</small>
              <strong>{formatCurrency(income, "EUR")}</strong>
            </span>
            <span>
              <small>Recorded expenses</small>
              <strong>{formatCurrency(expenses, "EUR")}</strong>
            </span>
          </div>
        </article>
      </section>

      <section className={styles.secondaryGrid}>
        <article className={styles.allocationCard}>
          <div className={styles.sectionHeader}>
            <span>Income allocation</span>
            <Sparkles size={17} />
          </div>

          <div className={styles.allocationContent}>
            <div className={styles.allocationRows}>
              <div>
                <span><b>Expenses</b><em>{expenseShare.toFixed(1)}%</em></span>
                <i><span style={{ width: `${expenseShare}%` }} /></i>
              </div>
              <div>
                <span><b>Total savings</b><em>{savingsRate.toFixed(1)}%</em></span>
                <i><span style={{ width: `${savingsShare}%` }} /></i>
              </div>
            </div>

            <div
              className={styles.savingsRing}
              style={{ "--executive-savings": `${Math.min(100, Math.max(0, savingsRate))}%` } as CSSProperties}
            >
              <strong>{savingsRate.toFixed(1)}%</strong>
              <span>Savings rate</span>
            </div>
          </div>
        </article>

        <article className={styles.commitmentsCard}>
          <div className={styles.sectionHeader}>
            <span>Upcoming commitments</span>
            <CalendarDays size={17} />
          </div>

          {upcomingBills.length ? (
            <div className={styles.billList}>
              {upcomingBills.map((bill) => (
                <div className={styles.billRow} key={bill.id}>
                  <span className={styles.billIcon}><CalendarDays size={15} /></span>
                  <div>
                    <strong>Scheduled bill</strong>
                    <small>{formatDueDate(bill.due_date)}</small>
                  </div>
                  <b>{formatCurrency(finiteNumber(bill.amount_eur), "EUR")}</b>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyCommitments}>
              <strong>No upcoming commitments</strong>
              <span>Your recorded bills are clear for now.</span>
            </div>
          )}

          <Link href="/dashboard/bills" className={styles.textLink}>
            View all bills <ArrowRight size={15} />
          </Link>
        </article>
      </section>

      <section className={styles.executiveFooter}>
        <div>
          <Sparkles size={18} />
          <span>
            <strong>Executive progress</strong>
            Your current journey is {journeyProgress}% through the FICONTER roadmap.
          </span>
        </div>
        <Link href="/dashboard/insights">View insights <ArrowRight size={15} /></Link>
      </section>
    </div>
  );
}
