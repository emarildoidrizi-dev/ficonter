import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/Brand";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";
import styles from "./LegalPageShell.module.css";

export function LegalPageShell({
  eyebrow,
  title,
  children,
  showPrelaunchNotice = false,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  showPrelaunchNotice?: boolean;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand />
          <Link className={styles.back} href="/">Back to FICONTER</Link>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.eyebrow}>{eyebrow}</div>
        <h1>{title}</h1>
        <p className={styles.updated}>Last updated: {LEGAL_LAST_UPDATED}</p>
        {showPrelaunchNotice ? (
          <div className={styles.notice}>
            This legal page is prepared for launch, but the operator identity, physical address and legal contact email must be completed before public commercial operation.
          </div>
        ) : null}
        {children}
        <nav className={styles.links} aria-label="Legal pages">
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/cookies">Cookies & local storage</Link>
          <Link href="/legal/imprint">Impressum</Link>
        </nav>
      </main>
    </div>
  );
}

export { styles as legalStyles };
