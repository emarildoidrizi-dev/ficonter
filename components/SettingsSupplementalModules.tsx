"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const PasskeySecuritySettings = dynamic(
  () =>
    import("@/components/PasskeySecuritySettings").then(
      (module) => module.PasskeySecuritySettings,
    ),
  { ssr: false, loading: () => null },
);

const BackupRecoverySettingsGate = dynamic(
  () =>
    import("@/components/BackupRecoverySettingsGate").then(
      (module) => module.BackupRecoverySettingsGate,
    ),
  { ssr: false, loading: () => null },
);

type SectionId =
  | "security"
  | "financial"
  | "notifications"
  | "appearance"
  | "privacy"
  | "subscription";

type Props = {
  userId: string;
  email: string;
  metadata: Record<string, unknown>;
  canAccessBackupRecovery: boolean;
};

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

type RuntimeMode = "pending" | "installed-phone" | "other";

const SECTION_IDS = new Set<SectionId>([
  "security",
  "financial",
  "notifications",
  "appearance",
  "privacy",
  "subscription",
]);

function currentRuntimeMode(): Exclude<RuntimeMode, "pending"> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "other";
  }

  const root = document.documentElement;
  const rootResolvedInstalledPhone =
    root.dataset.ficonterNativeApp === "true" &&
    root.dataset.ficonterDevice === "phone" &&
    root.dataset.ficonterDisplayMode === "standalone";

  if (rootResolvedInstalledPhone) return "installed-phone";

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as IOSNavigator).standalone);
  const width = Math.max(
    1,
    Math.round(
      window.visualViewport?.width ||
        window.innerWidth ||
        document.documentElement.clientWidth,
    ),
  );

  return standalone && width <= 640 ? "installed-phone" : "other";
}

function normalizeSection(value: string | null): SectionId | null {
  return value && SECTION_IDS.has(value as SectionId)
    ? (value as SectionId)
    : null;
}

export function SettingsSupplementalModules({
  userId,
  email,
  metadata,
  canAccessBackupRecovery,
}: Props) {
  const searchParams = useSearchParams();
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("pending");

  const section = useMemo(
    () => normalizeSection(searchParams.get("section")),
    [searchParams],
  );

  useEffect(() => {
    const resolve = () => setRuntimeMode(currentRuntimeMode());
    resolve();

    const displayMode = window.matchMedia("(display-mode: standalone)");
    window.addEventListener("resize", resolve);
    window.visualViewport?.addEventListener("resize", resolve);
    displayMode.addEventListener?.("change", resolve);

    return () => {
      window.removeEventListener("resize", resolve);
      window.visualViewport?.removeEventListener("resize", resolve);
      displayMode.removeEventListener?.("change", resolve);
    };
  }, []);

  if (runtimeMode === "pending") return null;

  if (runtimeMode === "installed-phone") {
    if (section === "security") {
      return <PasskeySecuritySettings />;
    }

    if (section === "privacy" && canAccessBackupRecovery) {
      return (
        <BackupRecoverySettingsGate
          userId={userId}
          email={email}
          metadata={metadata}
        />
      );
    }

    return null;
  }

  return (
    <>
      <PasskeySecuritySettings />

      {canAccessBackupRecovery ? (
        <BackupRecoverySettingsGate
          userId={userId}
          email={email}
          metadata={metadata}
        />
      ) : null}
    </>
  );
}
