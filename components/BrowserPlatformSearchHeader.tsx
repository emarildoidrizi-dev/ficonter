"use client";

import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import styles from "./BrowserPlatformSearchHeader.module.css";

function isDesktopBrowserPlatform() {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  return (
    root.dataset.ficonterDisplayMode === "browser" &&
    window.matchMedia("(min-width: 901px)").matches
  );
}

export function BrowserPlatformSearchHeader() {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let portalHost: HTMLDivElement | null = null;

    const synchronize = () => {
      const navigation = document.querySelector<HTMLElement>(
        'nav[aria-label="Personal finance navigation"]',
      );
      const topRow = navigation?.previousElementSibling as HTMLElement | null;

      if (!isDesktopBrowserPlatform() || !topRow) {
        portalHost?.remove();
        portalHost = null;
        setHost(null);
        return;
      }

      if (!portalHost) {
        portalHost = document.createElement("div");
        portalHost.dataset.ficonterPlatformSearch = "true";
        portalHost.className = styles.portalHost;
      }

      if (portalHost.parentElement !== topRow) {
        const actions = topRow.lastElementChild;
        topRow.insertBefore(portalHost, actions);
      }

      setHost(portalHost);
    };

    synchronize();

    const root = document.documentElement;
    const observer = new MutationObserver(synchronize);
    observer.observe(root, {
      attributes: true,
      attributeFilter: [
        "data-ficonter-display-mode",
        "data-ficonter-native-app",
        "data-ficonter-device",
      ],
    });

    const viewport = window.matchMedia("(min-width: 901px)");
    viewport.addEventListener?.("change", synchronize);
    window.addEventListener("resize", synchronize);

    return () => {
      observer.disconnect();
      viewport.removeEventListener?.("change", synchronize);
      window.removeEventListener("resize", synchronize);
      portalHost?.remove();
    };
  }, []);

  if (!host) return null;

  return createPortal(
    <button
      type="button"
      className={styles.searchButton}
      onClick={() => window.dispatchEvent(new Event("ficonter:open-command-palette"))}
      aria-label="Search anything in FICONTER"
      title="Search anything in FICONTER"
    >
      <Search size={18} aria-hidden="true" />
      <span className={styles.searchCopy}>
        <strong>Search anything</strong>
        <small>FICONTER only</small>
      </span>
      <span className={styles.shortcut} aria-hidden="true">Ctrl K</span>
    </button>,
    host,
  );
}
