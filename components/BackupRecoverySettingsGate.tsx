"use client";

import { useEffect } from "react";

import { BackupRecoverySettings } from "@/components/BackupRecoverySettings";

type Props = {
  userId: string;
  email: string;
  metadata: Record<string, unknown>;
};

export function BackupRecoverySettingsGate({ userId, email, metadata }: Props) {
  useEffect(() => {
    const panel = document.querySelector<HTMLElement>(
      'section[aria-labelledby="backup-recovery-title"]',
    );
    if (!panel) return;

    const cards = Array.from(panel.querySelectorAll<HTMLElement>("article"));
    const cleanups: Array<() => void> = [];

    const activateCard = (card: HTMLElement) => {
      const title = card.querySelector("strong")?.textContent?.trim() ?? "";
      if (!title) return;

      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.style.cursor = "pointer";

      const run = () => {
        if (title === "Download to device") {
          const input = panel.querySelector<HTMLInputElement>(
            'input[placeholder="At least 12 characters"]',
          );
          input?.scrollIntoView({ behavior: "smooth", block: "center" });
          window.setTimeout(() => input?.focus(), 250);
          return;
        }

        const providerMessage =
          title === "Google Drive"
            ? "Google Drive backup needs the customer's Google connection before direct backup can be enabled."
            : title === "OneDrive / Dropbox"
              ? "OneDrive and Dropbox backup need the customer's provider connection before direct backup can be enabled."
              : "Private cloud / S3 backup needs the customer's own storage credentials before direct backup can be enabled.";

        window.alert(providerMessage);
      };

      const onClick = () => run();
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          run();
        }
      };

      card.addEventListener("click", onClick);
      card.addEventListener("keydown", onKeyDown);
      cleanups.push(() => {
        card.removeEventListener("click", onClick);
        card.removeEventListener("keydown", onKeyDown);
      });
    };

    cards.forEach(activateCard);
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return (
    <BackupRecoverySettings
      userId={userId}
      email={email}
      metadata={metadata}
    />
  );
}
