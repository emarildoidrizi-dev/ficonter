"use client";

import Link from "next/link";
import { ArrowRight, Compass, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/financialOptions";
import type { FinancialGpsResult } from "@/lib/wealth/financialGps";
import styles from "./HorizonOverviewBoard.module.css";

type ActivityPoint = {
  amount: number;
  income: boolean;
};

type Props = {
  income: number;
  expenses: number;
  savings: number;
  cashFlow: number;
  savingsRate: number;
  activity: ActivityPoint[];
  gps: FinancialGpsResult;
};

function sparklinePath(activity: ActivityPoint[]) {
  const chronological = [...activity].reverse().slice(-18);
  const values = [0];
  let current = 0;
  for (const item of chronological) {
    current += item.income ? Math.abs(item.amount) : -Math.abs(item.amount);
    values.push(current);
  }

  if (values.length < 2) return "M 0 46 L 100 46";
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(1, maximum - minimum);

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 54 - ((value - minimum) / range) * 44;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function evidenceValue(item: FinancialGpsResult["primaryAction"]["evidence"][number]) {
  if (item.value === null) return "Pending";
  if (typeof item.value === "string") return item.value;
  if (item.format === "currency") return formatCurrency(item.value, "EUR");
  if (item.format === "percent") return `${item.value.toFixed(1)}%`;
  if (item.format === "months") return `${item.value.toFixed(1)} months`;
  if (item.format === "ratio") return `${item.value.toFixed(2)}×`;
  if (item.format === "score") return `${Math.round(item.value)} / 100`;
  return Math.round(item.value).toLocaleString("en-GB");
}

function allocationPercent(value: number, income: number) {
  if (income <= 0) return 0;
  return Math.min(100, Math.max(0, (value / income) * 100));
}

export function HorizonOverviewBoard({
  income,
  expenses,
  savings,
  cashFlow,
  savingsRate,
  activity,
  gps,
}: Props) {
  const path = sparklinePath(activity);
  const expenseShare = allocationPercent(expenses, income);
  const savingsShare = allocationPercent(savings, income);
  const remainingShare = allocationPercent(Math.max(0, cashFlow), income);
  const positive = cashFlow >= 0;

  return (
    <section className={styles.board} data-stage={gps.stage.id} aria-label="Horizon financial overview">
      <article className={`${styles.card} ${styles.cashFlowCard}`}>
        <div className={styles.cardTopline}>
          <span>Recorded cash position</span>
          <span className={positive ? styles.positiveBadge : styles.negativeBadge}>
            {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {positive ? "Positive" : "Needs attention"}
          </span>
        </div>
        <strong className={styles.heroNumber}>{formatCurrency(cashFlow, "EUR")}</strong>
        <p>Income minus all completed outflows recorded to date.</p>
        <div className={styles.sparkline} aria-hidden="true">
          <svg viewBox="0 0 100 60" preserveAspectRatio="none">
            <defs>
              <linearGradient id="horizon-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="var(--gold)" />
                <stop offset="1" stopColor="var(--sage)" />
              </linearGradient>
              <linearGradient id="horizon-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--gold)" stopOpacity=".25" />
                <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${path} L 100 60 L 0 60 Z`} fill="url(#horizon-area)" />
            <path d={path} fill="none" stroke="url(#horizon-line)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <div className={styles.miniStats}>
          <span><small>Recorded income</small><strong>{formatCurrency(income, "EUR")}</strong></span>
          <span><small>Recorded expenses</small><strong>{formatCurrency(expenses, "EUR")}</strong></span>
        </div>
      </article>

      <article className={`${styles.card} ${styles.allocationCard}`}>
        <div className={styles.cardTopline}>
          <span>Income allocation</span>
          <Sparkles size={17} aria-hidden="true" />
        </div>
        <div className={styles.allocationRows}>
          <div>
            <span><b>Expenses</b><em>{expenseShare.toFixed(1)}%</em></span>
            <i><span style={{ width: `${expenseShare}%` }} /></i>
          </div>
          <div>
            <span><b>Total savings</b><em>{savingsRate.toFixed(1)}%</em></span>
            <i><span style={{ width: `${savingsShare}%` }} /></i>
          </div>
          <div>
            <span><b>Remaining cash flow</b><em>{remainingShare.toFixed(1)}%</em></span>
            <i><span style={{ width: `${remainingShare}%` }} /></i>
          </div>
        </div>
        <p className={styles.allocationNote}>
          These values use the same Wealth Engine totals shown across FICONTER.
        </p>
      </article>

      <article className={`${styles.card} ${styles.gpsCard}`}>
        <div className={styles.gpsOrbit} aria-hidden="true">
          <span className={styles.orbitOne} />
          <span className={styles.orbitTwo} />
          <span className={styles.orbitThree} />
          <Compass size={24} />
        </div>
        <div className={styles.gpsContent}>
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
            {gps.primaryAction.evidence.length ? (
              <div className={styles.evidenceGrid}>
                {gps.primaryAction.evidence.slice(0, 3).map((item) => (
                  <span key={item.label}>
                    <small>{item.label}</small>
                    <strong>{evidenceValue(item)}</strong>
                  </span>
                ))}
              </div>
            ) : null}
          </details>
          <Link href="/dashboard/gps">
            Open Financial GPS <ArrowRight size={16} />
          </Link>
        </div>
      </article>
    </section>
  );
}
