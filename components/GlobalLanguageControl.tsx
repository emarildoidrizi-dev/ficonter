"use client";

import { usePathname } from "next/navigation";
import "@/lib/i18n/landingPageCurrentCatalog";
import "@/lib/i18n/landingHeroShowcaseCatalog";
import "@/lib/i18n/landingWhyCatalog";
import "@/lib/i18n/publicSiteChromeCatalog";
import "@/lib/i18n/publicPlatformCatalog";
import "@/lib/i18n/publicPersonalBusinessCatalog";
import "@/lib/i18n/publicPrivacyCatalog";
import "@/lib/i18n/publicAboutCatalog";
import { LanguageSelector } from "./LanguageSelector";
import styles from "./GlobalLanguageControl.module.css";

const LEGAL_PATHS = new Set([
  "/impressum",
  "/datenschutz",
  "/agb",
  "/widerruf",
  "/cookies",
]);

const PUBLIC_SITE_PATHS = new Set([
  "/",
  "/platform",
  "/personal-business",
  "/privacy",
  "/about",
]);

export function GlobalLanguageControl() {
  const pathname = usePathname();
  const insideApplication = pathname.startsWith("/dashboard") || pathname.startsWith("/business");
  const publicSitePageOwnsChrome = PUBLIC_SITE_PATHS.has(pathname);
  const whyPageOwnsPublicChrome = pathname.startsWith("/why/");
  const legalPageOwnsPublicChrome = LEGAL_PATHS.has(pathname);
  const publicPageOwnsChrome = publicSitePageOwnsChrome || whyPageOwnsPublicChrome || legalPageOwnsPublicChrome;
  const showLanguageControl = !insideApplication && !publicPageOwnsChrome;
  const showCopyright = !publicPageOwnsChrome;

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
