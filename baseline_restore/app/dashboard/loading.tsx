import Image from "next/image";
import styles from "./loading.module.css";

export default function DashboardLoading() {
  return (
    <div
      className={styles.page}
      role="status"
      aria-live="polite"
      aria-label="Opening page"
    >
      <div className={styles.loadingBrand}>
        <Image
          src="/ficonter-mark.svg"
          alt=""
          width={48}
          height={48}
          priority
          aria-hidden="true"
        />
        <div>
          <strong>Ficonter</strong>
          <span>Opening your financial command center</span>
        </div>
      </div>

      <div className={styles.titleRow}>
        <div className={`${styles.block} ${styles.heading}`} />
        <div className={`${styles.block} ${styles.action}`} />
      </div>
      <div className={styles.kpis}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div className={styles.card} key={index}>
            <div className={`${styles.block} ${styles.label}`} />
            <div className={`${styles.block} ${styles.value}`} />
          </div>
        ))}
      </div>
      <div className={styles.contentGrid}>
        <div className={styles.panel}>
          <div className={`${styles.block} ${styles.panelTitle}`} />
          {Array.from({ length: 6 }).map((_, index) => (
            <div className={styles.row} key={index}>
              <div className={styles.block} />
              <div className={styles.block} />
              <div className={styles.block} />
            </div>
          ))}
        </div>
        <div className={styles.panel}>
          <div className={`${styles.block} ${styles.panelTitle}`} />
          <div className={`${styles.block} ${styles.chart}`} />
        </div>
      </div>
      <span className={styles.srOnly}>
        Ficonter is opening the selected section.
      </span>
    </div>
  );
}
