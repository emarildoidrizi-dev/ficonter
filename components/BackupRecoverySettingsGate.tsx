"use client";

import { BackupRecoverySettings } from "@/components/BackupRecoverySettings";

type Props = {
  userId: string;
  email: string;
  metadata: Record<string, unknown>;
};

export function BackupRecoverySettingsGate({ userId, email, metadata }: Props) {
  return (
    <BackupRecoverySettings
      userId={userId}
      email={email}
      metadata={metadata}
    />
  );
}
