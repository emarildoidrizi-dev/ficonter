"use client";

import { useEffect, useState } from "react";
import styles from "./BrandedLoginEntrance.module.css";

const STANDARD_DURATION_MS = 980;
const REDUCED_MOTION_DURATION_MS = 300;

export function BrandedLoginEntrance() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reduceMotion
      ? REDUCED_MOTION_DURATION_MS
      : STANDARD_DURATION_MS;

    const timer = window.setTimeout(() => {
      setVisible(false);

      const url = new URL(window.location.href);
      if (url.pathname === "/login" && url.searchParams.has("entry")) {
        url.searchParams.delete("entry");
        const next = `${url.pathname}${url.search}${url.hash}`;
        window.history.replaceState(window.history.state, "", next);
      }
    }, duration);

    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={styles.entrance}
      role="status"
      aria-live="polite"
      aria-label="Opening FICONTER secure login"
    >
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={styles.brandStage}>
        <div className={styles.markHalo} aria-hidden="true">
          <img
            className={styles.mark}
            src="/ficonter-mark.svg"
            alt=""
            width={92}
            height={92}
          />
        </div>

        <div className={styles.identity} aria-hidden="true">
          <div className={styles.wordmark}>FICONTER</div>
          <div className={styles.descriptor}>Financial Control Center</div>
        </div>

        <div className={styles.entryLine} aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
