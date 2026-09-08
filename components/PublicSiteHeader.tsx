"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Fingerprint,
  Layers3,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

import { Brand } from "@/components/Brand";
import { LanguageSelector } from "@/components/LanguageSelector";
import { PlatformTransparencyNotice } from "@/components/PlatformTransparencyNotice";

import styles from "./PublicSiteHeader.module.css";

type MenuName = "platform" | "personal-business" | "privacy" | null;

const platformItems = [
  {
    href: "/platform",
    icon: Layers3,
    title: "Platform overview",
    copy: "See how FICONTER brings planning, money, wealth and intelligence together.",
  },
  {
    href: "/platform#planning",
    icon: WalletCards,
    title: "Planning & money",
    copy: "Transactions, bills, monthly planning, savings, debt and goals in one flow.",
  },
  {
    href: "/platform#intelligence",
    icon: Sparkles,
    title: "Financial intelligence",
    copy: "Understand health, cash flow, reserves and the signals that deserve attention.",
  },
  {
    href: "/privacy#security",
    icon: ShieldCheck,
    title: "Security & control",
    copy: "Learn how private workspaces, access controls and user ownership fit together.",
  },
] as const;

const personalBusinessItems = [
  {
    href: "/personal-business#personal",
    icon: UserRound,
    title: "Personal workspace",
    copy: "Household cash flow, obligations, savings, debt, goals and long-term direction.",
  },
  {
    href: "/personal-business#business",
    icon: BriefcaseBusiness,
    title: "Business workspace",
    copy: "Revenue, operating costs, inventory, suppliers and reporting in a dedicated context.",
  },
  {
    href: "/personal-business#together",
    icon: CircleDollarSign,
    title: "One account, two contexts",
    copy: "Switch between personal and business without mixing the records that matter.",
  },
] as const;

const privacyItems = [
  {
    href: "/privacy",
    icon: LockKeyhole,
    title: "Privacy overview",
    copy: "The principles behind FICONTER's private-by-design approach.",
  },
  {
    href: "/privacy#data-control",
    icon: Fingerprint,
    title: "Data ownership & control",
    copy: "What belongs to you, what FICONTER stores and the controls available to you.",
  },
  {
    href: "/privacy#security",
    icon: ShieldCheck,
    title: "Security architecture",
    copy: "Authentication, workspace isolation and database-level access safeguards.",
  },
  {
    href: "/datenschutz",
    icon: FileText,
    title: "Legal privacy policy",
    copy: "Read the formal privacy information and data-protection disclosures.",
  },
] as const;

export function PublicSiteHeader() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<MenuName>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <PlatformTransparencyNotice />
      <header className={styles.header} ref={headerRef}>
        <div className={styles.inner}>
          <Brand />

          <div className={styles.desktopArea}>
            <nav className={styles.nav} aria-label="Public navigation">
              <div
                className={styles.navGroup}
                onMouseEnter={() => setOpenMenu("platform")}
                onMouseLeave={() => setOpenMenu((current) => current === "platform" ? null : current)}
                onFocus={() => setOpenMenu("platform")}
              >
                <div className={styles.navTriggerRow}>
                  <Link className={isActive("/platform") ? styles.activeLink : undefined} href="/platform">
                    Platform
                  </Link>
                  <button
                    type="button"
                    className={styles.chevronButton}
                    aria-label="Open Platform menu"
                    aria-expanded={openMenu === "platform"}
                    onClick={() => setOpenMenu((current) => current === "platform" ? null : "platform")}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <div className={`${styles.megaMenu} ${openMenu === "platform" ? styles.megaMenuOpen : ""}`}>
                  <div className={styles.menuIntro}>
                    <span>FICONTER PLATFORM</span>
                    <strong>A financial control center built around decisions, not disconnected screens.</strong>
                    <Link href="/platform">Explore the full platform →</Link>
                  </div>
                  <div className={styles.menuGrid}>
                    {platformItems.map(({ href, icon: Icon, title, copy }) => (
                      <Link className={styles.menuItem} href={href} key={title}>
                        <div className={styles.menuIcon}><Icon size={18} /></div>
                        <div><strong>{title}</strong><span>{copy}</span></div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className={styles.navGroup}
                onMouseEnter={() => setOpenMenu("personal-business")}
                onMouseLeave={() => setOpenMenu((current) => current === "personal-business" ? null : current)}
                onFocus={() => setOpenMenu("personal-business")}
              >
                <div className={styles.navTriggerRow}>
                  <Link className={isActive("/personal-business") ? styles.activeLink : undefined} href="/personal-business">
                    Personal & Business
                  </Link>
                  <button
                    type="button"
                    className={styles.chevronButton}
                    aria-label="Open Personal and Business menu"
                    aria-expanded={openMenu === "personal-business"}
                    onClick={() => setOpenMenu((current) => current === "personal-business" ? null : "personal-business")}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <div className={`${styles.megaMenu} ${styles.megaMenuCompact} ${openMenu === "personal-business" ? styles.megaMenuOpen : ""}`}>
                  <div className={styles.workspacePreview}>
                    <div><UserRound size={18} /><span>Personal</span></div>
                    <div className={styles.workspaceLine} />
                    <div><Building2 size={18} /><span>Business</span></div>
                  </div>
                  <div className={styles.menuGridSingle}>
                    {personalBusinessItems.map(({ href, icon: Icon, title, copy }) => (
                      <Link className={styles.menuItem} href={href} key={title}>
                        <div className={styles.menuIcon}><Icon size={18} /></div>
                        <div><strong>{title}</strong><span>{copy}</span></div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className={styles.navGroup}
                onMouseEnter={() => setOpenMenu("privacy")}
                onMouseLeave={() => setOpenMenu((current) => current === "privacy" ? null : current)}
                onFocus={() => setOpenMenu("privacy")}
              >
                <div className={styles.navTriggerRow}>
                  <Link className={isActive("/privacy") ? styles.activeLink : undefined} href="/privacy">
                    Privacy
                  </Link>
                  <button
                    type="button"
                    className={styles.chevronButton}
                    aria-label="Open Privacy menu"
                    aria-expanded={openMenu === "privacy"}
                    onClick={() => setOpenMenu((current) => current === "privacy" ? null : "privacy")}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <div className={`${styles.megaMenu} ${styles.megaMenuPrivacy} ${openMenu === "privacy" ? styles.megaMenuOpen : ""}`}>
                  <div className={styles.trustPanel}>
                    <LockKeyhole size={23} />
                    <span>TRUST CENTER</span>
                    <strong>Your financial workspace should be understandable, controlled and private.</strong>
                  </div>
                  <div className={styles.menuGridSingle}>
                    {privacyItems.map(({ href, icon: Icon, title, copy }) => (
                      <Link className={styles.menuItem} href={href} key={title}>
                        <div className={styles.menuIcon}><Icon size={18} /></div>
                        <div><strong>{title}</strong><span>{copy}</span></div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <Link className={isActive("/about") ? styles.activeLink : undefined} href="/about">About</Link>
              <Link className={styles.loginLink} href="/login?entry=brand">Log in</Link>
              <Link className={styles.startButton} href="/register">Start free</Link>
            </nav>
            <LanguageSelector variant="public" />
          </div>

          <div className={styles.mobileActions}>
            <LanguageSelector variant="public" />
            <button
              type="button"
              className={styles.mobileToggle}
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <div className={`${styles.mobilePanel} ${mobileOpen ? styles.mobilePanelOpen : ""}`}>
          <div className={styles.mobilePanelInner}>
            <Link href="/platform"><Layers3 size={18} /> <span><strong>Platform</strong><small>Overview, planning and intelligence</small></span></Link>
            <Link href="/personal-business"><BriefcaseBusiness size={18} /> <span><strong>Personal & Business</strong><small>Two workspaces, one account</small></span></Link>
            <Link href="/privacy"><LockKeyhole size={18} /> <span><strong>Privacy</strong><small>Trust, control and security</small></span></Link>
            <Link href="/about"><BarChart3 size={18} /> <span><strong>About</strong><small>Why FICONTER exists</small></span></Link>
            <div className={styles.mobileDivider} />
            <Link href="/login?entry=brand">Log in</Link>
            <Link className={styles.mobileStart} href="/register">Start free</Link>
          </div>
        </div>
      </header>
    </>
  );
}
