"use client";

import Link from "next/link";
import { BriefcaseBusiness, WalletCards } from "lucide-react";
import { LanguageSelector } from "./LanguageSelector";
import styles from "./WorkspaceSwitcher.module.css";

export function WorkspaceSwitcher({
  current,
}: {
  current: "personal" | "business";
}) {
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
            href="/business"
            className={current === "business" ? styles.active : ""}
            aria-current={current === "business" ? "page" : undefined}
          >
            <BriefcaseBusiness size={16} aria-hidden="true" />
            Business
          </Link>
        </div>
        <LanguageSelector />
      </div>
    </nav>
  );
}
