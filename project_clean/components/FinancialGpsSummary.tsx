"use client";

import Link from "next/link";
import { ArrowRight, Compass, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import type { AiInsightsInputs } from "@/lib/wealth/aiInsights";
import { calculateFinancialGps } from "@/lib/wealth/financialGps";
import type { SetupAcknowledgements } from "@/lib/wealth/setupReadiness";
import styles from "./FinancialGpsSummary.module.css";

type Props = {
  inputs: AiInsightsInputs;
  acknowledgements: SetupAcknowledgements;
  error?: string;
};

export function FinancialGpsSummary({
  inputs,
  acknowledgements,
  error = "",
}: Props) {
  const gps = useMemo(
    () => calculateFinancialGps(inputs, acknowledgements),
    [acknowledgements, inputs],
  );

  return (
    <section className={styles.card} aria-label="Financial GPS summary">
      <div className={styles.icon}>
        <Compass size={23} aria-hidden="true" />
      </div>
      <div className={styles.content}>
        <div className={styles.labelRow}>
          <span>Financial GPS</span>
          <small>{gps.positionLabel}</small>
        </div>
        <h2>{gps.primaryAction.title}</h2>
        <p>
          {error
            ? "Guidance is temporarily unavailable. Open Financial GPS to try again."
            : gps.primaryAction.instruction}
        </p>
        <div className={styles.meta}>
          <span><ShieldCheck size={14} /> {gps.confidenceLabel}</span>
          <span>Stage {gps.stageIndex + 1}: {gps.stage.label}</span>
        </div>
      </div>
      <Link className={styles.link} href="/dashboard/gps">
        Open GPS <ArrowRight size={17} />
      </Link>
    </section>
  );
}
