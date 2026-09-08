import Link from "next/link";

import { Brand } from "@/components/Brand";

import styles from "./PublicSiteFooter.module.css";

export function PublicSiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <div className={styles.identity}>
          <Brand />
          <p>Financial control for the life you are building.</p>
        </div>
        <nav className={styles.navigation} aria-label="Footer navigation">
          <div>
            <span>Explore</span>
            <Link href="/platform">Platform</Link>
            <Link href="/personal-business">Personal & Business</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/about">About</Link>
          </div>
          <div>
            <span>Access</span>
            <Link href="/register">Start free</Link>
            <Link href="/login?entry=brand">Log in</Link>
          </div>
          <div>
            <span>Legal</span>
            <Link href="/impressum">Impressum</Link>
            <Link href="/datenschutz">Privacy Policy</Link>
            <Link href="/agb">Terms & Conditions</Link>
            <Link href="/widerruf">Withdrawal</Link>
            <Link href="/cookies">Cookies & Technology</Link>
          </div>
        </nav>
      </div>
      <div className={styles.bottom}>
        <span>© 2026 FICONTER. All rights reserved.</span>
        <span>FICONTER · Financial Control Center</span>
      </div>
    </footer>
  );
}
