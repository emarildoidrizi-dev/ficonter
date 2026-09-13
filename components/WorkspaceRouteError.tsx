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
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Keep technical detail in the console. Installed apps recover silently;
    // the manual recovery card remains available only to browser sessions.
    console.error("FICONTER route boundary", error);

    if (!isInstalledStandaloneApp()) {
      setShowFallback(true);
      return;
    }

    setShowFallback(false);
    setRetrying(true);

    const currentPath = window.location.pathname;
    const timer = window.setTimeout(() => {
      if (!navigator.onLine) {
        window.location.replace(
          currentPath === overviewHref ? "/offline.html" : overviewHref,
        );
        return;
      }

      if (shouldAttemptAutomaticRecovery()) {
        markAutomaticRecoveryAttempt();
        void recoverInstalledAppRuntime();
        return;
      }

      // If the same route fails again immediately after a runtime refresh,
      // leave the broken route automatically instead of exposing an error UI.
      // Overview is the safe in-app fallback; if Overview itself is the route
      // that failed, leave the workspace shell rather than entering a reload loop.
      void recoverInstalledAppRuntime(
        currentPath === overviewHref ? "/" : overviewHref,
      );
    }, 60);

    return () => window.clearTimeout(timer);
  }, [error, overviewHref]);

  function retry() {
    if (retrying) return;
    setRetrying(true);
    reset();
    window.setTimeout(() => setRetrying(false), 1200);
  }

  function openOverview() {
    const current = `${window.location.pathname}${window.location.search}`;
    if (!requestFiconterNavigationIntent(overviewHref, current)) return;
    router.replace(overviewHref, { scroll: false });
  }

  if (!showFallback) return null;

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
          {retrying ? "Retrying…" : "Retry"}
        </button>
        <button type="button" className={styles.secondary} onClick={openOverview}>
          <House size={16} aria-hidden="true" />
          Overview
        </button>
      </div>
    </section>
  );
}
