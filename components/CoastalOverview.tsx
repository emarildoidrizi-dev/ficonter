"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { Activity, ArrowRight, ChevronRight, CircleAlert, Plus, ReceiptText, Target, WalletCards } from "lucide-react";
import { formatCurrency, type CurrencyCode } from "@/lib/financialOptions";
import type { FinancialHealthResult } from "@/lib/wealth/financialHealth";
import type { FinancialGpsResult } from "@/lib/wealth/financialGps";
import styles from "./CoastalOverview.module.css";

export type CoastalUpcomingBill = {
  id: string;
  name: string;
  dueDate: string;
  amount: number | null;
};

type Props = {
  name: string;
  greeting: string;
  currency: CurrencyCode;
  availableNow: number;
  stillToPay: number;
  monthLabel: string;
  monthIncome: number;
  monthSpent: number;
  financialHealth: FinancialHealthResult;
  upcomingBills: CoastalUpcomingBill[];
  spendingRhythm: number | null;
  spendingAmount: number;
  spendingBudget: number;
  financialGps: FinancialGpsResult;
  previousMonthChange: number | null;
  errorMessages?: string[];
};

function dueLabel(dueDate: string): string {
  const due = new Date(`${dueDate}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export function CoastalOverview({
  name,
  greeting,
  currency,
  availableNow,
  stillToPay,
  monthLabel,
  monthIncome,
  monthSpent,
  financialHealth,
  upcomingBills,
  spendingRhythm,
  spendingAmount,
  spendingBudget,
  financialGps,
  previousMonthChange,
  errorMessages = [],
}: Props) {
  const leftAfterEverything = availableNow - stillToPay;
  const score = financialHealth.scoreAvailable ? financialHealth.score : 0;
  const scoreLabel = financialHealth.scoreAvailable
    ? financialHealth.label
    : "Finish setup";
  const safeSavingCapacity = Math.max(0, leftAfterEverything);
  const cashFlowScale = Math.max(monthIncome, monthSpent, 0);
  const cashFlowColumns = [
    { label: "Income", amount: Math.max(0, monthIncome), tone: "income" },
    { label: "Spent", amount: Math.max(0, monthSpent), tone: "spent" },
  ].map((column) => ({
    ...column,
    height: cashFlowScale > 0 ? (column.amount / cashFlowScale) * 100 : 0,
  }));
  const comparisonInsight = previousMonthChange === null
    ? "A full month will unlock spending comparisons"
    : previousMonthChange <= 0
      ? `Spending is ${Math.abs(previousMonthChange).toFixed(0)}% lower this month`
      : `Spending is ${previousMonthChange.toFixed(0)}% higher this month`;
  const uniqueErrors = [...new Set(errorMessages.filter(Boolean))];
  const hasSpendingBudget = spendingRhythm !== null && spendingBudget > 0;
  const spendingProgress = hasSpendingBudget
    ? Math.min(100, Math.max(0, spendingRhythm ?? 0))
    : 0;
  const spendingRhythmLabel = hasSpendingBudget
    ? `${Math.round(spendingRhythm ?? 0)}% of the monthly spending budget used`
    : "No monthly spending budget has been set";

  return (
    <div className={styles.overview}>
      {uniqueErrors.map((message) => (
        <div className={styles.error} key={message}>
          <CircleAlert size={17} />
          <span>{message}</span>
        </div>
      ))}

      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow} suppressHydrationWarning>{greeting}, {name}</span>
          <h1>Your financial horizon</h1>
          <p>Everything important, calmly in view.</p>
        </div>
        <Link className={styles.addMoney} href="/dashboard/transactions">
          <Plus size={18} />
          Add money
        </Link>
      </header>

      <section className={styles.cardGrid} aria-label="Financial overview">
        <article className={`${styles.card} ${styles.availableCard}`}>
          <Link className={styles.availableHeader} href="/dashboard/transactions" aria-label="Open account activity">
            <span className={styles.availableHeaderIcon} aria-hidden="true"><WalletCards size={20} /></span>
            <span className={styles.cardLabel}>Available now</span>
            <ChevronRight className={styles.availableHeaderChevron} size={22} aria-hidden="true" />
          </Link>
          <strong className={styles.availableAmount}>{formatCurrency(availableNow, currency)}</strong>
          <p className={styles.cardNote}>Across your active accounts</p>
          <div className={styles.cardDivider} aria-hidden="true" />
          <div className={styles.miniStats}>
            <Link className={styles.miniStat} href="/dashboard/bills">
              <span className={styles.miniStatIcon} aria-hidden="true"><ReceiptText size={19} /></span>
              <span className={styles.miniStatCopy}><span>Still to pay</span><strong>{formatCurrency(stillToPay, currency)}</strong></span>
              <ChevronRight className={styles.miniStatChevron} size={21} aria-hidden="true" />
            </Link>
            <Link className={styles.miniStat} href="/dashboard/budget">
              <span className={styles.miniStatIcon} aria-hidden="true"><WalletCards size={19} /></span>
              <span className={styles.miniStatCopy}><span>Left after everything</span><strong>{formatCurrency(leftAfterEverything, currency)}</strong></span>
              <ChevronRight className={styles.miniStatChevron} size={21} aria-hidden="true" />
            </Link>
          </div>
        </article>

        <article className={`${styles.card} ${styles.healthCard}`}>
          <div className={styles.healthHeader}>
            <h2>Financial health</h2>
            <span className={styles.healthInfo} aria-hidden="true"><Activity size={18} /></span>
          </div>
          <div className={styles.healthLine}>
            <strong>{financialHealth.scoreAvailable ? score : "—"}</strong>
            <div><span>/100</span><p>{scoreLabel}</p></div>
          </div>
          <div className={styles.healthTrack} aria-label={`Financial health ${score} out of 100`}>
            <span style={{ width: `${score}%` }} />
          </div>
          <p className={styles.healthMessage}>{financialHealth.nextBestAction}</p>
        </article>

        <article className={`${styles.card} ${styles.cashCard}`}>
          <h2>{monthLabel} cash flow</h2>
          <div className={styles.cashSummary}>
            <div><span>Income</span><strong>{formatCurrency(monthIncome, currency)}</strong></div>
            <div><span>Spent</span><strong>{formatCurrency(monthSpent, currency)}</strong></div>
          </div>
          <div
            className={styles.cashComparison}
            aria-label={`${monthLabel} income and spending, shown on the same scale`}
          >
            {cashFlowColumns.map((column) => (
              <div className={styles.cashColumn} key={column.label}>
                <div className={styles.cashColumnTrack}>
                  <span
                    data-tone={column.tone}
                    style={{ height: `${column.height}%` }}
                    title={`${column.label}: ${formatCurrency(column.amount, currency)}`}
                  />
                </div>
                <small>{column.label}</small>
              </div>
            ))}
          </div>
        </article>

        <article className={`${styles.card} ${styles.upcomingCard}`}>
          <h2>Upcoming</h2>
          <div className={styles.upcomingList}>
            {upcomingBills.length ? upcomingBills.map((bill) => (
              <Link href="/dashboard/bills" className={styles.upcomingItem} key={bill.id}>
                <time dateTime={bill.dueDate}>{Number(bill.dueDate.slice(-2))}</time>
                <span><strong>{bill.name}</strong><small>{dueLabel(bill.dueDate)}</small></span>
                <b>{bill.amount === null ? "—" : formatCurrency(bill.amount, currency)}</b>
              </Link>
            )) : (
              <div className={styles.emptyUpcoming}>No upcoming bills. Your horizon is clear.</div>
            )}
          </div>
        </article>

        <article
          className={`${styles.card} ${styles.rhythmCard}`}
          data-budget-state={hasSpendingBudget ? "available" : "missing"}
        >
          <h2>Monthly budget use</h2>
          <div
            className={styles.donut}
            role="img"
            aria-label={spendingRhythmLabel}
            style={{ "--progress": `${spendingProgress * 3.6}deg` } as CSSProperties}
          >
            <span>{hasSpendingBudget ? `${Math.round(spendingRhythm ?? 0)}%` : "—"}</span>
          </div>
          {hasSpendingBudget ? (
            <p>{formatCurrency(spendingAmount, currency)} of {formatCurrency(spendingBudget, currency)} monthly budget</p>
          ) : (
            <div className={styles.missingBudget}>
              <p>{formatCurrency(spendingAmount, currency)} spent this month · No monthly budget set</p>
              <Link href="/dashboard/budget">
                Set a monthly budget <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </article>

        <article className={`${styles.card} ${styles.insightsCard}`}>
          <h2>Smart insights</h2>
          <div className={styles.insightList}>
            <Link href="/dashboard/cash-flow"><span>↗ {comparisonInsight}</span><ArrowRight size={15} /></Link>
            <Link href="/dashboard/savings"><span>◎ You can save {formatCurrency(safeSavingCapacity, currency)} more safely</span><ArrowRight size={15} /></Link>
            <Link href={financialGps.primaryAction.href}><span>△ {financialGps.primaryAction.title}</span><ArrowRight size={15} /></Link>
          </div>
        </article>
      </section>

      <Link className={styles.mobileGpsLink} href="/dashboard/gps">
        <Target size={17} /> Open Financial GPS <ArrowRight size={16} />
      </Link>
    </div>
  );
}
