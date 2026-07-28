"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ListChecks, ShieldCheck } from "lucide-react";
import type { FinancialHealthInputs } from "@/lib/wealth/financialHealth";
import {
  calculateFinancialSetup,
  type SetupAcknowledgements,
} from "@/lib/wealth/setupReadiness";
import styles from "./FinancialSetupSummary.module.css";

export function FinancialSetupSummary({
  inputs,
  acknowledgements,
}: {
  inputs: FinancialHealthInputs;
  acknowledgements: SetupAcknowledgements;
}) {
  const setup = calculateFinancialSetup(inputs, acknowledgements);
  const status = setup.profileComplete
    ? "Complete"
    : setup.scoreReady
      ? "Score ready"
      : "Setup required";

  return (
    <section className={styles.card} aria-label="Financial setup progress">
      <div className={styles.icon} aria-hidden="true">
        {setup.profileComplete ? <CheckCircle2 size={24} /> : <ListChecks size={24} />}
      </div>

      <div className={styles.content}>
        <div className={styles.headingRow}>
          <div>
            <span className={styles.eyebrow}>Financial profile</span>
            <h2>{status}</h2>
          </div>
          <strong>{setup.completionPercentage}%</strong>
        </div>

        <div
          className={styles.progress}
          role="progressbar"
          aria-label="Financial profile completion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={setup.completionPercentage}
        >
          <span style={{ width: `${setup.completionPercentage}%` }} />
        </div>

        <div className={styles.details}>
          <p>
            {setup.profileComplete
              ? "Your core financial areas are recorded or explicitly confirmed. FICONTER can interpret your position with stronger context."
              : setup.scoreReady
                ? "Your score can now be calculated provisionally. Complete the remaining areas to improve context and recommendation quality."
                : "Add income and real outflows first so FICONTER can calculate a meaningful financial position."}
          </p>

          <div className={styles.statusLine}>
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              Score readiness: <strong>{setup.scoreReadinessLabel}</strong>
            </span>
            <span className={styles.separator}>·</span>
            <span>
              {setup.completedCount} of {setup.totalCount} areas complete
            </span>
          </div>
        </div>
      </div>

      <Link className={styles.action} href="/dashboard/setup">
        {setup.profileComplete ? "Review setup" : "Continue setup"}
        <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </section>
  );
}
