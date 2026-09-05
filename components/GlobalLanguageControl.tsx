"use client";

import { usePathname } from "next/navigation";
import { LanguageSelector } from "./LanguageSelector";
import styles from "./GlobalLanguageControl.module.css";

export function GlobalLanguageControl() {
  const pathname = usePathname();
  const insideApplication = pathname.startsWith("/dashboard") || pathname.startsWith("/business");
  const landingOwnsLanguageControl = pathname === "/";
  const showLanguageControl = !insideApplication && !landingOwnsLanguageControl;

  return (
    <>
      {showLanguageControl ? (
        <div className={styles.control}>
          <LanguageSelector variant="public" />
        </div>
      ) : null}
      <div
        className={`${styles.copyright}${insideApplication ? ` ${styles.copyrightApplication}` : ""}`}
        aria-label="Copyright notice"
      >
        © 2026 FICONTER. All rights reserved.
      </div>
    </>
  );
}
