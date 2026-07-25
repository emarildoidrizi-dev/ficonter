"use client";

import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { TYPE_BY_VALUE, type FlowDirection } from "@/lib/financialOptions";
import styles from "./FinancialHealthScore.module.css";

type Transaction = {
  id: string;
  type: string;
  amount: number | string;
  amount_eur: number | string | null;
  transaction_date: string;
};

type Props = { transactions: Transaction[] };

type HealthBreakdown = {
  score: number;
  label: "Excellent" | "Healthy" | "Stable" | "Needs attention" | "At risk";
  summary: string;
  savingsRate: number;
  netCashFlow: number;
};

const directionOf = (type: string): FlowDirection =>
  TYPE_BY_VALUE[type]?.direction ??
  (type === "income" ? "inflow" : "outflow");

const isSavingType = (type: string) =>
  type.toLowerCase().includes("saving");

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function calculateHealth(transactions: Transaction[]): HealthBreakdown {
  let income = 0;
  let expenses = 0;
  let savings = 0;

  for (const item of transactions) {
    const amount = Number(item.amount_eur ?? item.amount ?? 0);
    if (!Number.isFinite(amount)) continue;

    if (isSavingType(item.type)) {
      savings += amount;
      continue;
    }

    const direction = directionOf(item.type);
    if (direction === "inflow") income += amount;
    if (direction === "outflow") expenses += amount;
  }

  const netCashFlow = income - expenses - savings;
  const savingsRate = income > 0 ? savings / income : 0;
  const expenseRatio = income > 0 ? expenses / income : 1;

  const cashFlowScore =
    income > 0 ? clamp((netCashFlow / income) * 160 + 20, 0, 40) : 0;
  const savingsScore =
    income > 0 ? clamp((savingsRate / 0.2) * 30, 0, 30) : 0;
  const spendingScore =
    income > 0 ? clamp((1 - expenseRatio) * 40, 0, 20) : 0;
  const activityScore = clamp((transactions.length / 12) * 10, 0, 10);

  const score = Math.round(
    clamp(cashFlowScore + savingsScore + spendingScore + activityScore, 0, 100),
  );

  if (score >= 90) {
    return {
      score,
      label: "Excellent",
      summary: "Your recorded cash flow and saving habits show an excellent financial foundation.",
      savingsRate,
      netCashFlow,
    };
  }
  if (score >= 75) {
    return {
      score,
      label: "Healthy",
      summary: "Your finances are in a healthy position, with only limited areas to improve.",
      savingsRate,
      netCashFlow,
    };
  }
  if (score >= 60) {
    return {
      score,
      label: "Stable",
      summary: "Your finances are stable, although cash flow, saving consistency or spending can still improve.",
      savingsRate,
      netCashFlow,
    };
  }
  if (score >= 40) {
    return {
      score,
      label: "Needs attention",
      summary: "Your current records indicate pressure in cash flow or saving consistency.",
      savingsRate,
      netCashFlow,
    };
  }
  return {
    score,
    label: "At risk",
    summary: "Your recorded outflows are placing significant pressure on your finances.",
    savingsRate,
    netCashFlow,
  };
}

export function FinancialHealthScore({ transactions }: Props) {
  const health = useMemo(() => calculateHealth(transactions), [transactions]);
  const circumference = 2 * Math.PI * 46;
  const dashOffset = circumference - (health.score / 100) * circumference;

  return (
    <section className={styles.card} aria-label="Financial health score">
      <div className={styles.gaugeWrap}>
        <svg
          className={styles.gauge}
          viewBox="0 0 112 112"
          role="img"
          aria-label={`Financial health score ${health.score} out of 100`}
        >
          <circle className={styles.gaugeTrack} cx="56" cy="56" r="46" />
          <circle
            className={styles.gaugeValue}
            cx="56"
            cy="56"
            r="46"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>

        <div className={styles.score}>
          <strong>{health.score}</strong>
          <span>/ 100</span>
        </div>
      </div>

      <div className={styles.copy}>
        <span className={styles.eyebrow}>Financial health</span>
        <div
          className={styles.statusRow}
          data-status={health.label.toLowerCase().replaceAll(" ", "-")}
        >
          <ShieldCheck size={18} />
          <strong>{health.label}</strong>
        </div>
        <p className={styles.explanation}>
          Savings rate is one part of your overall financial health.
        </p>
      </div>
    </section>
  );}
