"use client";

import { usePathname } from "next/navigation";
import "@/lib/i18n/landingPageCurrentCatalog";
import "@/lib/i18n/landingHeroShowcaseCatalog";
import { LanguageSelector } from "./LanguageSelector";
import styles from "./GlobalLanguageControl.module.css";

const LEGAL_PATHS = new Set([
  "/impressum",
  "/datenschutz",
  "/agb",
  "/widerruf",
  "/cookies",
]);

export function GlobalLanguageControl() {
  const pathname = usePathname();
  const insideApplication = pathname.startsWith("/dashboard") || pathname.startsWith("/business");
  const landingOwnsLanguageControl = pathname === "/";
  const legalPageOwnsPublicChrome = LEGAL_PATHS.has(pathname);
  const showLanguageControl = !insideApplication && !landingOwnsLanguageControl && !legalPageOwnsPublicChrome;
  const showCopyright = !landingOwnsLanguageControl && !legalPageOwnsPublicChrome;

  return (
    <>
      {showLanguageControl ? (
        <div className={styles.control}>
          <LanguageSelector variant="public" />
        </div>
      ) : null}
      {showCopyright ? (
        <div
          className={`${styles.copyright}${insideApplication ? ` ${styles.copyrightApplication}` : ""}`}
          aria-label="Copyright notice"
        >
          © 2026 FICONTER. All rights reserved.
        </div>
      ) : null}
    </>
  );
}
