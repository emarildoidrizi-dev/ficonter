"use client";

import { useEffect, useState } from "react";

import { BackupRecoverySettings } from "@/components/BackupRecoverySettings";

type Props = {
  userId: string;
  email: string;
  metadata: Record<string, unknown>;
};

function isPrivacySectionVisible() {
  if (typeof window === "undefined") return false;

  const section = new URLSearchParams(window.location.search).get("section");
  if (section === "privacy") return true;

  const headings = Array.from(
    document.querySelectorAll<HTMLElement>("h1, h2, h3, [role='heading']"),
  );

  return headings.some((heading) => {
    const text = heading.textContent?.trim().toLowerCase();
    if (text !== "data & privacy") return false;

    const style = window.getComputedStyle(heading);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

export function BackupRecoverySettingsGate({ userId, email, metadata }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const syncVisibility = () => setVisible(isPrivacySectionVisible());
    syncVisibility();

    const observer = new MutationObserver(syncVisibility);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"],
    });

    window.addEventListener("popstate", syncVisibility);
    window.addEventListener("ficonter:locationchange", syncVisibility);

    const interval = window.setInterval(syncVisibility, 250);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.removeEventListener("popstate", syncVisibility);
      window.removeEventListener("ficonter:locationchange", syncVisibility);
    };
  }, []);

  if (!visible) return null;

  return (
    <BackupRecoverySettings
      userId={userId}
      email={email}
      metadata={metadata}
    />
  );
}
