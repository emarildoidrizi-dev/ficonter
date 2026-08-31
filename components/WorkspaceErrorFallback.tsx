"use client";

import Link from "next/link";
import { useEffect } from "react";
import styles from "./WorkspaceErrorFallback.module.css";

export function WorkspaceErrorFallback({
  error,
  reset,
  overviewHref,
  workspaceLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  overviewHref: string;
  workspaceLabel: string;
}) {
  useEffect(() => {
    console.error("FICONTER workspace render failure", {
      workspace: workspaceLabel,
      digest: error.digest ?? null,
      message: error.message,
    });
  }, [error, workspaceLabel]);

  return (
    <main className={styles.shell}>
      <section className={styles.card} role="alert" aria-live="assertive">
        <p className={styles.eyebrow}>FICONTER recovery</p>
        <h1 className={styles.title}>This workspace needs to recover.</h1>
        <p className={styles.copy}>
          Your saved financial data is not changed by this screen. Retry the
          current view, or return to the workspace Overview and continue from
          there.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={reset}>
            <span>Retry</span>
          </button>
          <Link className={styles.secondary} href={overviewHref}>
            Go to Overview
          </Link>
        </div>
        {error.digest ? (
          <p className={styles.reference}>Reference: {error.digest}</p>
        ) : null}
      </section>
    </main>
  );
}
