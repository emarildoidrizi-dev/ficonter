import Link from "next/link";
import type { ReactNode } from "react";

import { Brand } from "@/components/Brand";
import { legalIdentityReady } from "@/lib/legal/publicIdentity";

import styles from "./PublicLegalPage.module.css";

export function PublicLegalPage({
  eyebrow,
  title,
  intro,
  children,
  updated = "7 September 2026",
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
  updated?: string;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand />
          <nav className={styles.headerNav} aria-label="Legal page navigation">
            <Link href="/">Landing page</Link>
            <Link href="/login?entry=brand">Log in</Link>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.eyebrow}>{eyebrow}</div>
        <h1>{title}</h1>
        <p className={styles.intro}>{intro}</p>

        {!legalIdentityReady ? (
          <div className={styles.notice} role="note">
            <strong>Pre-launch legal draft</strong>
            The legal operator name and full service address still have to be confirmed before these pages are used as the final public legal notice. The structure and remaining legal information are being prepared now so those details can be inserted without redesigning the site.
          </div>
        ) : null}

        <div className={styles.content}>{children}</div>
        <p className={styles.meta}>Last updated: {updated}</p>
      </main>

      <footer className={styles.footer}>
        <span>© 2026 FICONTER. All rights reserved.</span>
        <nav aria-label="Legal links">
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Privacy</Link>
          <Link href="/agb">Terms</Link>
          <Link href="/widerruf">Withdrawal</Link>
          <Link href="/cookies">Cookies & technology</Link>
        </nav>
      </footer>
    </div>
  );
}

export function PublicLegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
