"use client";

import { useEffect } from "react";

import styles from "./BrowserHeaderLayerPolicy.module.css";

const FOREGROUND_SELECTOR = [
  '[aria-modal="true"]',
  'dialog[open]',
  '[data-ficonter-foreground-window="true"]',
  '[data-ficonter-modal="true"]',
].join(",");

function isVisible(element: HTMLElement) {
  if (
    !element.isConnected ||
    element.hidden ||
    element.getAttribute("aria-hidden") === "true"
  ) {
    return false;
  }

  const computed = window.getComputedStyle(element);
  return (
    computed.display !== "none" &&
    computed.visibility !== "hidden" &&
    element.getClientRects().length > 0
  );
}

export function BrowserHeaderLayerPolicy() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let activeHeader: HTMLElement | null = null;

    const synchronize = () => {
      frame = 0;

      const navigation = document.querySelector<HTMLElement>(
        'nav[aria-label="Personal finance navigation"]',
      );
      const header = navigation?.closest<HTMLElement>("header") ?? null;
      const isBrowser = root.dataset.ficonterDisplayMode === "browser";

      if (activeHeader && activeHeader !== header) {
        activeHeader.removeAttribute("data-ficonter-browser-shell-header");
      }

      activeHeader = header;

      if (header && isBrowser) {
        header.dataset.ficonterBrowserShellHeader = "true";
      } else {
        header?.removeAttribute("data-ficonter-browser-shell-header");
      }

      const foregroundOpen = Boolean(
        isBrowser &&
          Array.from(
            document.querySelectorAll<HTMLElement>(FOREGROUND_SELECTOR),
          ).some(
            (element) =>
              element !== root &&
              !header?.contains(element) &&
              isVisible(element),
          ),
      );

      if (foregroundOpen) {
        root.dataset.ficonterForegroundLayerOpen = "true";
      } else {
        delete root.dataset.ficonterForegroundLayerOpen;
      }
    };

    const scheduleSynchronize = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(synchronize);
    };

    synchronize();

    const bodyObserver = new MutationObserver(scheduleSynchronize);
    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "aria-modal",
        "aria-hidden",
        "hidden",
        "open",
        "style",
        "class",
      ],
    });

    const rootObserver = new MutationObserver(scheduleSynchronize);
    rootObserver.observe(root, {
      attributes: true,
      attributeFilter: [
        "data-ficonter-display-mode",
        "data-ficonter-native-app",
        "data-ficonter-device",
      ],
    });

    return () => {
      bodyObserver.disconnect();
      rootObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      activeHeader?.removeAttribute("data-ficonter-browser-shell-header");
      delete root.dataset.ficonterForegroundLayerOpen;
    };
  }, []);

  return <span className={styles.policySentinel} aria-hidden="true" />;
}
