"use client";

import { useState } from "react";
import {
  Activity,
  ChevronDown,
  Landmark,
  PiggyBank,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
} from "lucide-react";
import { formatCurrency } from "@/lib/financialOptions";
import type {
  WealthScoreFactor,
  WealthScoreFactorId,
  WealthScoreResult,
} from "@/lib/wealth/wealthScore";
import styles from "./WealthScore.module.css";

const FACTOR_ICONS = {
  "net-position": Landmark,
  accumulation: PiggyBank,
  "debt-reduction": TrendingDown,
  "capital-balance": Scale,
  momentum: Activity,
  goals: Target,
  resilience: ShieldCheck,
} satisfies Record<WealthScoreFactorId, typeof Landmark>;

function factorMetric(factor: WealthScoreFactor): string {
  if (factor.metricLabel) return factor.metricLabel;
  if (factor.metricUnit === "currency") return formatCurrency(factor.metricValue, "EUR");
  if (factor.metricUnit === "percent") return `${factor.metricValue.toFixed(1)}%`;
  if (factor.metricUnit === "months") return `${factor.metricValue.toFixed(1)} months`;
  if (factor.metricUnit === "ratio") return `${factor.metricValue.toFixed(2)}×`;
  if (factor.metricUnit === "count") return Math.round(factor.metricValue).toLocaleString("en-US");
  return "—";
}

export function WealthScore({
  result,
  error = "",
}: {
  result: WealthScoreResult;
  error?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const circumference = 2 * Math.PI * 46;
  const displayedScore = result.scoreAvailable ? result.score : 0;
  const dashOffset = circumference - (displayedScore / 100) * circumference;
  const statusSlug = result.label.toLowerCase().replaceAll(" ", "-");

  return (
    <section className={styles.module} aria-label="Wealth score">
      <article className={styles.card}>
        <div className={styles.gaugeWrap}>
          <svg
            className={styles.gauge}
            viewBox="0 0 112 112"
            role="img"
            aria-label={
              result.scoreAvailable
                ? `Wealth score ${result.score} out of 100`
                : "Wealth score pending profile completion"
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
            <span className={styles.eyebrow}>Wealth Score</span>
            <span className={styles.version}>v{result.version}</span>
          </div>
          <div className={styles.statusRow} data-status={statusSlug}>
            <Landmark size={18} aria-hidden="true" />
            <strong>{result.label}</strong>
          </div>
          <p className={styles.summary}>{result.summary}</p>

          <div className={styles.quickMetrics}>
            <span>
              <small>Net wealth</small>
              <strong>{formatCurrency(result.metrics.netWorth, "EUR")}</strong>
            </span>
            <span>
              <small>Capital / debt</small>
              <strong>
                {result.metrics.capitalToDebtRatioAvailable
                  ? `${result.metrics.capitalToDebtRatio.toFixed(2)}×`
                  : result.metrics.currentDebt <= 0 && result.factors.find(
                        (factor) => factor.id === "capital-balance",
                      )?.assessed
                    ? "Debt-free"
                    : "Not recorded"}
              </strong>
            </span>
            <span>
              <small>3-month retention</small>
              <strong>
                {result.metrics.recentRetentionAvailable
                  ? `${(result.metrics.recentRetentionRate * 100).toFixed(1)}%`
                  : "Awaiting 3 months"}
              </strong>
            </span>
          </div>

          <button
            type="button"
            className={styles.breakdownButton}
            aria-expanded={expanded}
            aria-controls="wealth-score-breakdown"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Hide wealth breakdown" : "View wealth breakdown"}
            <ChevronDown className={expanded ? styles.chevronOpen : ""} size={16} />
          </button>
        </div>
      </article>

      {expanded ? (
        <div className={styles.breakdown} id="wealth-score-breakdown">
          <header className={styles.breakdownHeader}>
            <div>
              <span>Long-term scoring</span>
              <h2>How your Wealth Score is built</h2>
              <p>
                The score extends your existing Financial Health data. Savings,
                debt progress, goals and emergency reserves are reused from the
                same source of truth, while Net Worth adds recorded capital and
                twelve-month momentum.
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
                        <span>{factorMetric(factor)}</span>
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
              <span>Next best wealth action</span>
              <strong>{result.nextBestAction}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
