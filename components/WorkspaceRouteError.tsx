"use client";

import { useEffect, useState } from "react";
import { House, RefreshCw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { requestFiconterNavigationIntent } from "@/lib/navigationRuntime";
import {
  isInstalledStandaloneApp,
  recoverInstalledAppRuntime,
} from "@/lib/pwaRuntimeRecovery";
import styles from "./WorkspaceRouteError.module.css";

const AUTO_RECOVERY_PREFIX = "ficonter:route-auto-recovery:";
const AUTO_RECOVERY_TTL_MS = 90 * 1000;

function autoRecoveryKey() {
  return `${AUTO_RECOVERY_PREFIX}${window.location.pathname}`;
}

function shouldAttemptAutomaticRecovery() {
  if (!isInstalledStandaloneApp() || !navigator.onLine) return false;

  try {
    const previousAttempt = Number(
      window.sessionStorage.getItem(autoRecoveryKey()) || "0",
    );
    return (
      !Number.isFinite(previousAttempt) ||
      Date.now() - previousAttempt >= AUTO_RECOVERY_TTL_MS
    );
  } catch {
    return true;
  }
}

function markAutomaticRecoveryAttempt() {
  try {
    window.sessionStorage.setItem(autoRecoveryKey(), String(Date.now()));
  } catch {
    // The recovery still works when session storage is unavailable.
  }
}

export function WorkspaceRouteError({
  error,
  reset,
  overviewHref,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  overviewHref: string;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    // Keep the technical detail in the console while presenting a clean,
    // recoverable state to the user.
    console.error("FICONTER route boundary", error);

    if (!shouldAttemptAutomaticRecovery()) return;

    markAutomaticRecoveryAttempt();
    setRetrying(true);

    const timer = window.setTimeout(() => {
      void recoverInstalledAppRuntime();
    }, 80);

    return () => window.clearTimeout(timer);
  }, [error]);

  function retry() {
    if (retrying) return;
    setRetrying(true);

    if (isInstalledStandaloneApp() && navigator.onLine) {
      markAutomaticRecoveryAttempt();
      void recoverInstalledAppRuntime();
      return;
    }

    reset();
    window.setTimeout(() => setRetrying(false), 1200);
  }

  function openOverview() {
    const current = `${window.location.pathname}${window.location.search}`;
    if (!requestFiconterNavigationIntent(overviewHref, current)) return;
    router.replace(overviewHref, { scroll: false });
  }

  return (
    <section className={styles.card} role="alert" aria-live="assertive">
      <span className={styles.icon} aria-hidden="true">
        <TriangleAlert size={22} />
      </span>
      <div className={styles.copy}>
        <span className={styles.eyebrow}>Navigation recovery</span>
        <h2>This section could not open cleanly.</h2>
        <p>Your workspace is still safe. Retry this section, or return to Overview.</p>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={retry} disabled={retrying}>
          <RefreshCw size={16} aria-hidden="true" />
          {retrying ? "Refreshing app…" : "Retry"}
        </button>
        <button type="button" className={styles.secondary} onClick={openOverview}>
          <House size={16} aria-hidden="true" />
          Overview
        </button>
      </div>
    </section>
  );
}
