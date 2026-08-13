"use client";

import { useState } from "react";
import {
  CalendarCheck2,
  ChevronDown,
  CreditCard,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, type CurrencyCode } from "@/lib/financialOptions";
import { useCurrencyDisplay } from "@/components/CurrencyDisplayProvider";
import type {
  FinancialHealthFactor,
  FinancialHealthFactorId,
  FinancialHealthResult,
} from "@/lib/wealth/financialHealth";
import styles from "./FinancialHealthScore.module.css";

const FACTOR_ICONS = {
  "cash-flow": TrendingUp,
  savings: PiggyBank,
  debt: CreditCard,
  bills: ReceiptText,
  "emergency-fund": ShieldCheck,
  goals: Target,
  planning: CalendarCheck2,
} satisfies Record<FinancialHealthFactorId, typeof TrendingUp>;

function factorMetric(factor: FinancialHealthFactor, baseCurrency: CurrencyCode): string {
  if (factor.metricLabel) return factor.metricLabel;

  if (factor.metricUnit === "currency") {
    return formatCurrency(factor.metricValue, baseCurrency);
  }
  if (factor.metricUnit === "percent") {
    return `${factor.metricValue.toFixed(1)}%`;
  }
  if (factor.metricUnit === "months") {
    return `${factor.metricValue.toFixed(1)} months`;
  }
  if (factor.metricUnit === "count") {
    return Math.round(factor.metricValue).toLocaleString("en-US");
  }
  return "—";
}

export function FinancialHealthScore({
  result,
  error = "",
}: {
  result: FinancialHealthResult;
  error?: string;
}) {
  const { baseCurrency } = useCurrencyDisplay();
  const [expanded, setExpanded] = useState(false);
  const circumference = 2 * Math.PI * 46;
  const displayedScore = result.scoreAvailable ? result.score : 0;
  const dashOffset = circumference - (displayedScore / 100) * circumference;
  const statusSlug = result.label.toLowerCase().replaceAll(" ", "-");
  const cashFlowFactor = result.factors.find((factor) => factor.id === "cash-flow");
  const savingsFactor = result.factors.find((factor) => factor.id === "savings");

  return (
    <section className={styles.module} aria-label="Financial health score">
      <article className={styles.card}>
        <div className={styles.gaugeWrap}>
          <svg
            className={styles.gauge}
            viewBox="0 0 112 112"
            role="img"
            aria-label={
              result.scoreAvailable
                ? `Financial health score ${result.score} out of 100`
                : "Financial health score pending profile completion"
            }
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
            <strong>{result.scoreAvailable ? result.score : "—"}</strong>
            <span>{result.scoreAvailable ? "/ 100" : "Pending"}</span>
          </div>
        </div>

        <div className={styles.copy}>
          <div className={styles.eyebrowRow}>
            <span className={styles.eyebrow}>Financial Health Score</span>
            <span className={styles.version}>v{result.version}</span>
          </div>
          <div className={styles.statusRow} data-status={statusSlug}>
            <ShieldCheck size={18} />
            <strong>{result.label}</strong>
          </div>
          <p className={styles.summary}>{result.summary}</p>

          <div className={styles.quickMetrics}>
            <span>
              <small>Cash-flow margin</small>
              <strong>
                {cashFlowFactor?.assessed
                  ? `${(result.metrics.cashFlowMargin * 100).toFixed(1)}%`
                  : "Pending"}
              </strong>
            </span>
            <span>
              <small>Savings rate</small>
              <strong>
                {savingsFactor?.assessed
                  ? `${(result.metrics.savingsRate * 100).toFixed(1)}%`
                  : "Pending"}
              </strong>
            </span>
          </div>

          <button
            type="button"
            className={styles.breakdownButton}
            aria-expanded={expanded}
            aria-controls="financial-health-breakdown"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Hide score breakdown" : "View score breakdown"}
            <ChevronDown className={expanded ? styles.chevronOpen : ""} size={16} />
          </button>
        </div>
      </article>

      {expanded ? (
        <div className={styles.breakdown} id="financial-health-breakdown">
          <header className={styles.breakdownHeader}>
            <div>
              <span>Transparent scoring</span>
              <h2>How your score is built</h2>
              <p>
                One calculation uses your existing Transactions, Bills, Debt,
                Goals and Monthly Planner records. No parallel balances or
                duplicate financial values are created.
              </p>
            </div>
            <div className={styles.confidence}>
              <small>Data confidence</small>
              <strong>{result.confidence}</strong>
              <span>{result.dataCoverage}% coverage</span>
            </div>
          </header>

          {error ? <div className={styles.error}>{error}</div> : null}

          <div className={styles.factorList}>
            {result.factors.map((factor) => {
              const Icon = FACTOR_ICONS[factor.id];
              return (
                <article className={styles.factor} key={factor.id} data-status={factor.status}>
                  <div className={styles.factorIcon}>
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <div className={styles.factorBody}>
                    <div className={styles.factorTop}>
                      <div>
                        <strong>{factor.name}</strong>
                        <span>{factorMetric(factor, baseCurrency)}</span>
                      </div>
                      <b>
                        {factor.assessed ? (
                          <>
                            {factor.points.toFixed(1)} <small>/ {factor.maximum}</small>
                          </>
                        ) : (
                          <small>Pending</small>
                        )}
                      </b>
                    </div>
                    <div className={styles.factorTrack} aria-hidden="true">
                      <span style={{ width: `${factor.percentage}%` }} />
                    </div>
                    <p>{factor.explanation}</p>
                    <small className={styles.factorAction}>{factor.action}</small>
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.nextAction}>
            <Sparkles size={20} aria-hidden="true" />
            <div>
              <span>Next best action</span>
              <strong>{result.nextBestAction}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
