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
    const navigationLabel = workspace === "business" ? "Business navigation" : "Personal finance navigation";
    const navigation = document.querySelector<HTMLElement>(`nav[aria-label="${navigationLabel}"]`);
    const settingsLink = workspace === "personal"
      ? navigation?.querySelector<HTMLElement>('a[href="/dashboard/settings"]')
      : null;
    const header = navigation?.closest<HTMLElement>("header") ?? document.querySelector<HTMLElement>("header");
    const headerActions = header?.querySelector<HTMLElement>('[class*="headerActions"]');
    const accountDock = headerActions?.querySelector<HTMLElement>('[class*="accountDock"]');

    const desktop = document.createElement("span");
    desktop.className = styles.desktopHost;
    if (navigation) {
      if (settingsLink) navigation.insertBefore(desktop, settingsLink);
      else navigation.appendChild(desktop);
      setDesktopHost(desktop);
    }

    const mobile = document.createElement("span");
    mobile.className = styles.mobileHost;
    if (headerActions) {
      if (accountDock) headerActions.insertBefore(mobile, accountDock);
      else headerActions.appendChild(mobile);
      setMobileHost(mobile);
    }

    return () => {
      desktop.remove();
      mobile.remove();
      setDesktopHost(null);
      setMobileHost(null);
    };
  }, [workspace]);

  return (
    <>
      {desktopHost ? createPortal(<VaultHeaderControl />, desktopHost) : null}
      {mobileHost ? createPortal(<VaultHeaderControl />, mobileHost) : null}
    </>
  );
}
