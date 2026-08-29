"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { VaultHeaderControl } from "@/components/VaultHeaderControl";
import styles from "./VaultHeaderControl.module.css";

type VaultWorkspace = "personal" | "business";

export function VaultNavigationMount({ workspace = "personal" }: { workspace?: VaultWorkspace }) {
  const [desktopHost, setDesktopHost] = useState<HTMLElement | null>(null);
  const [mobileHost, setMobileHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let desktop: HTMLSpanElement | null = null;
    let mobile: HTMLSpanElement | null = null;
    let observer: MutationObserver | null = null;
    let frame = 0;

    function cleanupHosts() {
      desktop?.remove();
      mobile?.remove();
      desktop = null;
      mobile = null;
      setDesktopHost(null);
      setMobileHost(null);
    }

    function mountHosts() {
      const navigationLabel = workspace === "business" ? "Business navigation" : "Personal finance navigation";
      const navigation = document.querySelector<HTMLElement>(`nav[aria-label="${navigationLabel}"]`);
      if (!navigation) return false;

      const settingsLink = workspace === "personal"
        ? navigation.querySelector<HTMLElement>('a[href="/dashboard/settings"]')
        : null;
      const header = navigation.closest<HTMLElement>("header") ?? document.querySelector<HTMLElement>("header");
      const headerActions = header?.querySelector<HTMLElement>('[class*="headerActions"]');
      const accountDock = headerActions?.querySelector<HTMLElement>('[class*="accountDock"]');

      if (!desktop || !desktop.isConnected) {
        desktop?.remove();
        desktop = document.createElement("span");
        desktop.className = styles.desktopHost;
        if (settingsLink) navigation.insertBefore(desktop, settingsLink);
        else navigation.appendChild(desktop);
        setDesktopHost(desktop);
      }

      if (headerActions && (!mobile || !mobile.isConnected)) {
        mobile?.remove();
        mobile = document.createElement("span");
        mobile.className = styles.mobileHost;
        if (accountDock) headerActions.insertBefore(mobile, accountDock);
        else headerActions.appendChild(mobile);
        setMobileHost(mobile);
      }

      return true;
    }

    function scheduleMount() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        mountHosts();
      });
    }

    mountHosts();

    observer = new MutationObserver(() => {
      scheduleMount();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const handleNavigation = () => scheduleMount();
    window.addEventListener("popstate", handleNavigation);
    window.addEventListener("pageshow", handleNavigation);
    window.addEventListener("focus", handleNavigation);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("popstate", handleNavigation);
      window.removeEventListener("pageshow", handleNavigation);
      window.removeEventListener("focus", handleNavigation);
      cleanupHosts();
    };
  }, [workspace]);

  return (
    <>
      {desktopHost ? createPortal(<VaultHeaderControl />, desktopHost) : null}
      {mobileHost ? createPortal(<VaultHeaderControl />, mobileHost) : null}
    </>
  );
}
