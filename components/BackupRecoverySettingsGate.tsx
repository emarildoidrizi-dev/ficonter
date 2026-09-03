"use client";

import { useEffect, useState } from "react";

import { BackupRecoverySettings } from "@/components/BackupRecoverySettings";

type Props = {
  userId: string;
  email: string;
  metadata: Record<string, unknown>;
};

function currentSection() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("section");
}

export function BackupRecoverySettingsGate({ userId, email, metadata }: Props) {
  const [section, setSection] = useState<string | null>(null);

  useEffect(() => {
    const syncSection = () => setSection(currentSection());
    syncSection();

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = (...args) => {
      originalPushState(...args);
      window.dispatchEvent(new Event("ficonter:locationchange"));
    };

    window.history.replaceState = (...args) => {
      originalReplaceState(...args);
      window.dispatchEvent(new Event("ficonter:locationchange"));
    };

    window.addEventListener("popstate", syncSection);
    window.addEventListener("ficonter:locationchange", syncSection);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", syncSection);
      window.removeEventListener("ficonter:locationchange", syncSection);
    };
  }, []);

  if (section !== "privacy") return null;

  return (
    <BackupRecoverySettings
      userId={userId}
      email={email}
      metadata={metadata}
    />
  );
}
