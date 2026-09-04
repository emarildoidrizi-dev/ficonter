"use client";

import { PortableBackupRecoverySettings } from "@/components/PortableBackupRecoverySettings";

type Props = {
  userId: string;
  email: string;
  metadata: Record<string, unknown>;
};

export function BackupRecoverySettingsGate({ userId, email, metadata }: Props) {
  return (
    <PortableBackupRecoverySettings
      userId={userId}
      email={email}
      metadata={metadata}
    />
  );
}
