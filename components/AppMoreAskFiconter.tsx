"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { ChevronRight, LockKeyhole, MessageCircleQuestion } from "lucide-react";
import { useEffect, useState } from "react";

import styles from "./AppMoreAskFiconter.module.css";

type Props = {
  available: boolean;
};

function isInstalledApp() {
  const root = document.documentElement;
  return (
    root.dataset.ficonterDisplayMode === "standalone" &&
    root.dataset.ficonterNativeApp === "true"
  );
}

export function AppMoreAskFiconter({ available }: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let portalHost: HTMLDivElement | null = null;

    const synchronize = () => {
      const navigation = document.querySelector<HTMLElement>(
        'nav[aria-label="All app sections"]',
      );

      if (!isInstalledApp() || !navigation) {
        portalHost?.remove();
        portalHost = null;
        setHost(null);
        return;
      }

      if (!portalHost) {
        portalHost = document.createElement("div");
        portalHost.dataset.ficonterAskMoreEntry = "true";
      }

      if (portalHost.parentElement !== navigation) navigation.appendChild(portalHost);
      setHost(portalHost);
    };

    synchronize();
    const root = document.documentElement;
    const observer = new MutationObserver(synchronize);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-ficonter-display-mode", "data-ficonter-native-app"],
    });

    return () => {
      observer.disconnect();
      portalHost?.remove();
    };
  }, []);

  if (!host) return null;

  const href = available
    ? "/dashboard/insights/ask-ficonter"
    : "/dashboard/settings?section=subscription&required=advanced_financial_recommendations";

  return createPortal(
    <section className={styles.group} aria-labelledby="ask-ficonter-more-label">
      <div className={styles.label} id="ask-ficonter-more-label">FICONTER intelligence</div>
      <Link
        href={href}
        prefetch={available}
        className={styles.link}
        aria-label={available ? "Open Ask FICONTER" : "Ask FICONTER — Personal Pro required"}
      >
        <span className={styles.icon} aria-hidden="true">
          {available ? <MessageCircleQuestion size={19} /> : <LockKeyhole size={18} />}
        </span>
        <span className={styles.copy}>
          <strong>Ask FICONTER</strong>
          <small>{available ? "Financial decision intelligence" : "Personal Pro required"}</small>
        </span>
        <ChevronRight size={17} aria-hidden="true" />
      </Link>
    </section>,
    host,
  );
}
