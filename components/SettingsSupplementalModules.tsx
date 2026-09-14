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

const ProfileIdentityDetailsForm = dynamic(
  () =>
    import("@/components/ProfileIdentityDetailsForm").then(
      (module) => module.ProfileIdentityDetailsForm,
    ),
  { ssr: false, loading: () => null },
);

type SectionId =
  | "profile"
  | "security"
  | "financial"
  | "notifications"
  | "appearance"
  | "privacy"
  | "subscription";

type ProfileIdentityDetails = {
  birthDate: string;
  country: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
};

type Props = {
  userId: string;
  email: string;
  metadata: Record<string, unknown>;
  canAccessBackupRecovery: boolean;
  initialFullName: string;
  initialDisplayName: string;
  initialValues: ProfileIdentityDetails;
};

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

type RuntimeMode = "pending" | "installed-phone" | "other";

const SECTION_IDS = new Set<SectionId>([
  "profile",
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
  initialFullName,
  initialDisplayName,
  initialValues,
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

    if (section === "profile") {
      return (
        <ProfileIdentityDetailsForm
          userId={userId}
          initialFullName={initialFullName}
          initialDisplayName={initialDisplayName}
          initialValues={initialValues}
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

      <ProfileIdentityDetailsForm
        userId={userId}
        initialFullName={initialFullName}
        initialDisplayName={initialDisplayName}
        initialValues={initialValues}
      />
    </>
  );
}
