"use client";

import { Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AskFiconterLauncher } from "@/components/AskFiconterLauncher";

import styles from "./AskFiconterAdaptiveEntry.module.css";

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

const APP_RETRACTED_SESSION_KEY = "ficonter:ask-ficonter-retracted";
const APP_SWIPE_THRESHOLD = 34;
const APP_ROUTE = "/dashboard/insights/ask-ficonter";

function isStandaloneApp() {
  if (typeof window === "undefined") return false;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as IOSNavigator).standalone);
  const root = document.documentElement;

  return (
    standalone &&
    root.dataset.ficonterNativeApp !== "false" &&
    root.dataset.ficonterDevice !== "desktop"
  );
}

export function AskFiconterAdaptiveEntry({
  userId,
  baseCurrency,
  available = true,
}: {
  userId: string;
  baseCurrency: string;
  available?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pointerStartXRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const [resolved, setResolved] = useState(false);
  const [standaloneApp, setStandaloneApp] = useState(false);
  const [retracted, setRetracted] = useState(false);

  useEffect(() => {
    const active = isStandaloneApp();
    setStandaloneApp(active);

    if (active) {
      try {
        setRetracted(
          window.sessionStorage.getItem(APP_RETRACTED_SESSION_KEY) === "1",
        );
      } catch {
        // The control still works when session storage is unavailable.
      }
    }

    setResolved(true);
  }, []);

  useEffect(() => {
    if (!resolved || !standaloneApp) return;

    try {
      window.sessionStorage.setItem(
        APP_RETRACTED_SESSION_KEY,
        retracted ? "1" : "0",
      );
    } catch {
      // Ignore restricted/private app storage failures.
    }
  }, [resolved, retracted, standaloneApp]);

  if (!available || !resolved) return null;

  if (!standaloneApp) {
    return (
      <AskFiconterLauncher
        userId={userId}
        baseCurrency={baseCurrency}
        available={available}
      />
    );
  }

  if (pathname === APP_ROUTE) return null;

  function suppressNextClick() {
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  return (
    <button
      type="button"
      className={styles.appLauncher}
      data-retracted={retracted ? "true" : "false"}
      onPointerDown={(event) => {
        pointerStartXRef.current = event.clientX;
        suppressClickRef.current = false;
      }}
      onPointerUp={(event) => {
        const startX = pointerStartXRef.current;
        pointerStartXRef.current = null;
        if (startX === null) return;

        const deltaX = event.clientX - startX;
        if (deltaX <= -APP_SWIPE_THRESHOLD) {
          setRetracted(true);
          suppressNextClick();
        } else if (deltaX >= APP_SWIPE_THRESHOLD) {
          setRetracted(false);
          suppressNextClick();
        }
      }}
      onPointerCancel={() => {
        pointerStartXRef.current = null;
      }}
      onClick={() => {
        if (suppressClickRef.current) return;
        router.prefetch(APP_ROUTE);
        router.push(APP_ROUTE, { scroll: false });
      }}
      aria-label="Open Ask FICONTER"
      title="Ask FICONTER"
    >
      <span className={styles.icon} aria-hidden="true">
        <Sparkles size={18} />
      </span>
      <span className={styles.copy}>
        <strong>Ask FICONTER</strong>
        <small>Financial decision intelligence</small>
      </span>
    </button>
  );
}
