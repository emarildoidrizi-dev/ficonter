"use client";

import Link from "next/link";
import { BriefcaseBusiness, LockKeyhole, WalletCards } from "lucide-react";
import { getSubscriptionUpgradeHref } from "@/lib/subscriptionNavigation";
import { hasSubscriptionFeature, type SubscriptionPlanCode } from "@/lib/subscriptionPlans";
import { LanguageSelector } from "./LanguageSelector";
import styles from "./WorkspaceSwitcher.module.css";

export function WorkspaceSwitcher({
  current,
  subscriptionPlanCode,
}: {
  current: "personal" | "business";
  subscriptionPlanCode: SubscriptionPlanCode;
}) {
  const businessLocked =
    current === "personal" &&
    !hasSubscriptionFeature(subscriptionPlanCode, "business_workspace");
  const businessHref = businessLocked
    ? getSubscriptionUpgradeHref("business_workspace")
    : "/business";
  return (
    <nav className={styles.switcher} aria-label="Choose Ficonter workspace">
      <span className={styles.label}>Workspace</span>
      <div className={styles.controls}>
        <div className={styles.options}>
          <Link
            href="/dashboard"
            className={current === "personal" ? styles.active : ""}
            aria-current={current === "personal" ? "page" : undefined}
          >
            <WalletCards size={16} aria-hidden="true" />
            Personal
          </Link>
          <Link
            href={businessHref}
            className={current === "business" ? styles.active : ""}
            aria-current={current === "business" ? "page" : undefined}
            aria-label={businessLocked ? "Business — Business Pro required" : undefined}
          >
            <BriefcaseBusiness size={16} aria-hidden="true" />
            Business
            {businessLocked ? <LockKeyhole size={13} aria-hidden="true" /> : null}
          </Link>
        </div>
        <LanguageSelector />
      </div>
    </nav>
  );
}
