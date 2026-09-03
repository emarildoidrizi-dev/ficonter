"use client";

import { useSearchParams } from "next/navigation";

import { BackupRecoverySettings } from "@/components/BackupRecoverySettings";

type Props = {
  userId: string;
  email: string;
  metadata: Record<string, unknown>;
};

export function BackupRecoverySettingsGate({ userId, email, metadata }: Props) {
  const searchParams = useSearchParams();
  const section = searchParams.get("section");

  if (section !== "privacy") return null;

  return (
    <BackupRecoverySettings
      userId={userId}
      email={email}
      metadata={metadata}
    />
  );
}
