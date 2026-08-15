import Link from "next/link";
import { ArrowRight, Check, Flag } from "lucide-react";
import type { FinancialGpsResult } from "@/lib/wealth/financialGps";
import styles from "./FinancialJourneyRail.module.css";

type Props = {
  gps: FinancialGpsResult;
};

export function FinancialJourneyRail({ gps }: Props) {
  return (
    <section className={styles.shell} aria-label="FICONTER financial journey">
      <div className={styles.heading}>
        <div>
          <span>Financial journey</span>
          <strong>{gps.milestone}</strong>
        </div>
        <Link href="/dashboard/gps">
          View full path <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <div className={styles.rail}>
        <div className={styles.line} aria-hidden="true">
          <span style={{ width: `${(gps.stageIndex / Math.max(1, gps.stages.length - 1)) * 100}%` }} />
        </div>
        {gps.stages.map((stage, index) => {
          const complete = index < gps.stageIndex;
          const current = index === gps.stageIndex;
          return (
            <div
              className={`${styles.stage} ${complete ? styles.complete : ""} ${current ? styles.current : ""}`}
              key={stage.id}
              aria-current={current ? "step" : undefined}
            >
              <span className={styles.node}>
                {complete ? <Check size={14} /> : current ? <Flag size={13} /> : index + 1}
              </span>
              <strong>{stage.label}</strong>
              <small>{stage.description}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
