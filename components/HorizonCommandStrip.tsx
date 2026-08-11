"use client";

import type { CSSProperties } from "react";
import { AlertTriangle, Command, Route, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency, type CurrencyCode } from "@/lib/financialOptions";
import { useCurrencyDisplay } from "@/components/CurrencyDisplayProvider";
import type { FinancialGpsResult } from "@/lib/wealth/financialGps";
import styles from "./HorizonCommandStrip.module.css";

type Props = {
  gps: FinancialGpsResult;
};

function cashFlowSummary(gps: FinancialGpsResult, displayCurrency: CurrencyCode) {
  const cashFlow = gps.metrics.find((metric) => metric.id === "cash-flow");
  if (cashFlow?.value === null || cashFlow?.value === undefined) {
    return {
      label: "Baseline pending",
      value: "Add income and an outflow",
      tone: "neutral" as const,
      icon: Sparkles,
    };
  }

  if (cashFlow.value < 0) {
    return {
      label: "Negative cash flow",
      value: formatCurrency(cashFlow.value, displayCurrency),
      tone: "critical" as const,
      icon: TrendingDown,
    };
  }

  return {
    label: cashFlow.value > 0 ? "Positive cash flow" : "Cash flow balanced",
    value: formatCurrency(cashFlow.value, displayCurrency),
    tone: cashFlow.value > 0 ? ("positive" as const) : ("warning" as const),
    icon: TrendingUp,
  };
}

function riskSummary(gps: FinancialGpsResult) {
  if (gps.primaryAction.tone === "critical") {
    return {
      label: "Immediate attention",
      value: gps.primaryAction.domain,
      tone: "critical" as const,
    };
  }

  if (gps.primaryAction.tone === "warning") {
    return {
      label: "Priority area",
      value: gps.primaryAction.domain,
      tone: "warning" as const,
    };
  }

  if (gps.notice) {
    return {
      label: "Confidence developing",
      value: `${Math.round(gps.coverage)}% guidance coverage`,
      tone: "neutral" as const,
    };
  }

  return {
    label: "No urgent issue detected",
    value: "Continue the current plan",
    tone: "positive" as const,
  };
}

export function HorizonCommandStrip({ gps }: Props) {
  const { baseCurrency } = useCurrencyDisplay();
  const cashFlow = cashFlowSummary(gps, baseCurrency);
  const risk = riskSummary(gps);
  const CashFlowIcon = cashFlow.icon;
  const journeyProgress = Math.round(((gps.stageIndex + 1) / gps.stages.length) * 100);

  function openCommandPalette() {
    window.dispatchEvent(new CustomEvent("ficonter:open-command-palette"));
  }

  return (
    <section className={styles.strip} aria-label="Financial command strip">
      <div className={`${styles.item} ${styles[cashFlow.tone]}`}>
        <span className={styles.icon}><CashFlowIcon size={17} aria-hidden="true" /></span>
        <div>
          <small>Now</small>
          <strong>{cashFlow.label}</strong>
          <span>{cashFlow.value}</span>
        </div>
      </div>

      <div className={`${styles.item} ${styles.next}`}>
        <span className={styles.icon}><Route size={17} aria-hidden="true" /></span>
        <div>
          <small>Next priority</small>
          <strong>{gps.primaryAction.title}</strong>
          <span>{gps.primaryAction.domain}</span>
        </div>
      </div>

      <div className={`${styles.item} ${styles[risk.tone]}`}>
        <span className={styles.icon}><AlertTriangle size={17} aria-hidden="true" /></span>
        <div>
          <small>Risk</small>
          <strong>{risk.label}</strong>
          <span>{risk.value}</span>
        </div>
      </div>

      <div className={styles.progressItem}>
        <div
          className={styles.progressRing}
          style={{ "--horizon-progress": `${journeyProgress}%` } as CSSProperties}
          aria-label={`${journeyProgress}% through the FICONTER financial journey`}
        >
          <span>{journeyProgress}%</span>
        </div>
        <div>
          <small>Progress</small>
          <strong>{gps.stage.label}</strong>
          <span>Stage {gps.stageIndex + 1} of {gps.stages.length}</span>
        </div>
      </div>

      <button type="button" className={styles.commandButton} onClick={openCommandPalette}>
        <Command size={16} aria-hidden="true" />
        <span>Navigate</span>
        <kbd>Ctrl K</kbd>
      </button>
    </section>
  );
}
