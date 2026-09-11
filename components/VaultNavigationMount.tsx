"use client";

import Link from "next/link";
import { LockKeyhole, MessageCircleQuestion, Music2 } from "lucide-react";

import { VaultHeaderControl } from "@/components/VaultHeaderControl";
import { getSubscriptionUpgradeHref } from "@/lib/subscriptionNavigation";
import {
  hasSubscriptionFeature,
  type SubscriptionPlanCode,
} from "@/lib/subscriptionPlans";
import styles from "./VaultHeaderControl.module.css";

type VaultWorkspace = "personal" | "business";

type Props = {
  workspace?: VaultWorkspace;
  subscriptionPlanCode?: SubscriptionPlanCode;
  isPlatformOwner?: boolean;
};

/**
 * Permanent browser utility placement anchored to the existing desktop Vault.
 * Installed-app navigation is intentionally handled by the native app chrome.
 */
export function VaultNavigationMount({
  workspace = "personal",
  subscriptionPlanCode = "free",
  isPlatformOwner = false,
}: Props) {
  const personal = workspace === "personal";
  const askAvailable =
    personal &&
    hasSubscriptionFeature(
      subscriptionPlanCode,
      "advanced_financial_recommendations",
    );
  const askHref = askAvailable
    ? "/dashboard/insights/ask-ficonter"
    : getSubscriptionUpgradeHref("advanced_financial_recommendations");

  return (
    <span
      className={styles.persistentDesktopHost}
      data-ficonter-vault-slot="desktop"
      aria-label={personal ? "FICONTER browser utilities" : undefined}
    >
      <VaultHeaderControl />

      {personal ? (
        <Link
          href={askHref}
          prefetch={askAvailable}
          className={styles.utilityTrigger}
          aria-label={askAvailable ? "Open Ask FICONTER" : "Ask FICONTER — Personal Pro required"}
          title={askAvailable ? "Ask FICONTER" : "Ask FICONTER · Personal Pro required"}
        >
          {askAvailable ? (
            <MessageCircleQuestion size={15} aria-hidden="true" />
          ) : (
            <LockKeyhole size={14} aria-hidden="true" />
          )}
          <span>Ask FICONTER</span>
        </Link>
      ) : null}

      {personal && isPlatformOwner ? (
        <button
          type="button"
          className={styles.utilityTrigger}
          onClick={() => window.dispatchEvent(new Event("ficonter:owner-music-open"))}
          aria-label="Open Owner Music"
          title="Owner Music"
        >
          <Music2 size={15} aria-hidden="true" />
          <span>Owner Music</span>
        </button>
      ) : null}
    </span>
  );
}
