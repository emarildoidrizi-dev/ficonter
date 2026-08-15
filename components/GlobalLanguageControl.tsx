"use client";

import { usePathname } from "next/navigation";
import { LanguageSelector } from "./LanguageSelector";
import styles from "./GlobalLanguageControl.module.css";

export function GlobalLanguageControl() {
  const pathname = usePathname();
  const insideApplication = pathname.startsWith("/dashboard") || pathname.startsWith("/business");
  const landingOwnsLanguageControl = pathname === "/";

  if (insideApplication || landingOwnsLanguageControl) return null;

  return (
    <div className={styles.control}>
      <LanguageSelector variant="public" />
    </div>
  );
}
