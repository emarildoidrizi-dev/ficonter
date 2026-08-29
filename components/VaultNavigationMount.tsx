"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { VaultHeaderControl } from "@/components/VaultHeaderControl";
import styles from "./VaultHeaderControl.module.css";

type VaultWorkspace = "personal" | "business";

const DESKTOP_HOST_ATTR = "data-ficonter-vault-desktop-host";
const MOBILE_HOST_ATTR = "data-ficonter-vault-mobile-host";

export function VaultNavigationMount({ workspace: _workspace = "personal" }: { workspace?: VaultWorkspace }) {
  const [desktopHost, setDesktopHost] = useState<HTMLElement | null>(null);
  const [mobileHost, setMobileHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    let frame = 0;

    function findActiveNavigation() {
      return (
        document.querySelector<HTMLElement>('nav[aria-label="Business navigation"]') ??
        document.querySelector<HTMLElement>('nav[aria-label="Personal finance navigation"]')
      );
    }

    function ensureHosts() {
      const navigation = findActiveNavigation();
      if (!navigation) {
        setDesktopHost(null);
        setMobileHost(null);
        return;
      }

      const isPersonal = navigation.getAttribute("aria-label") === "Personal finance navigation";
      const settingsLink = isPersonal
        ? navigation.querySelector<HTMLElement>('a[href="/dashboard/settings"]')
        : null;
      const header = navigation.closest<HTMLElement>("header") ?? document.querySelector<HTMLElement>("header");
      const headerActions = header?.querySelector<HTMLElement>('[class*="headerActions"]');
      const accountDock = headerActions?.querySelector<HTMLElement>('[class*="accountDock"]');

      let desktop = navigation.querySelector<HTMLElement>(`[${DESKTOP_HOST_ATTR}]`);
      if (!desktop) {
        desktop = document.createElement("span");
        desktop.className = styles.desktopHost;
        desktop.setAttribute(DESKTOP_HOST_ATTR, "true");
        if (settingsLink) navigation.insertBefore(desktop, settingsLink);
        else navigation.appendChild(desktop);
      }
      setDesktopHost((current) => (current === desktop ? current : desktop));

      if (!headerActions) {
        setMobileHost(null);
        return;
      }

      let mobile = headerActions.querySelector<HTMLElement>(`[${MOBILE_HOST_ATTR}]`);
      if (!mobile) {
        mobile = document.createElement("span");
        mobile.className = styles.mobileHost;
        mobile.setAttribute(MOBILE_HOST_ATTR, "true");
        if (accountDock) headerActions.insertBefore(mobile, accountDock);
        else headerActions.appendChild(mobile);
      }
      setMobileHost((current) => (current === mobile ? current : mobile));
    }

    function scheduleMount() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(ensureHosts);
    }

    ensureHosts();

    observer = new MutationObserver(scheduleMount);
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
      setDesktopHost(null);
      setMobileHost(null);
    };
  }, []);

  return (
    <>
      {desktopHost?.isConnected ? createPortal(<VaultHeaderControl />, desktopHost) : null}
      {mobileHost?.isConnected ? createPortal(<VaultHeaderControl />, mobileHost) : null}
    </>
  );
}
