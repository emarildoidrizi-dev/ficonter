"use client";

import Link from "next/link";
import {
  Activity, ArrowLeft, ArrowLeftRight, BriefcaseBusiness, ChartPie, ChevronDown, Compass,
  CreditCard, FileArchive, Landmark, LayoutDashboard,
  LockKeyhole, LogOut, MessageSquareText, PiggyBank, ReceiptText, Route,
  Settings2, ShieldCheck, Sparkles, Target, TrendingUp, UserRound, WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { OPEN_CONTACT_EVENT } from "@/lib/support";
import { getSubscriptionUpgradeHref, subscriptionFeatureForPersonalRoute } from "@/lib/subscriptionNavigation";
import { hasSubscriptionFeature, type SubscriptionPlanCode } from "@/lib/subscriptionPlans";
import { Brand } from "./Brand";
import { ContactSupportModal } from "./ContactSupportModal";
import { LanguageSelector } from "./LanguageSelector";
import { NotificationCenter } from "./NotificationCenter";
import styles from "./SidebarNavigation.module.css";

type SidebarUser = { displayName: string; email: string; avatarPath: string };
type ProfileUpdatedDetail = { displayName?: string; fullName?: string; profilePhotoPath?: string; email?: string };
type NavigationLink = readonly [href: string, icon: LucideIcon, label: string];
type NavigationGroup = { label: string; links: readonly NavigationLink[] };

const navigationGroups: readonly NavigationGroup[] = [
  { label: "Money", links: [
    ["/dashboard/transactions", ArrowLeftRight, "Transactions"],
    ["/dashboard/bills", ReceiptText, "Bills"],
    ["/dashboard/credit-cards", CreditCard, "Credit Cards"],
    ["/dashboard/debt", Landmark, "Debts"],
    ["/dashboard/cash-flow", Activity, "Cash flow"],
  ] },
  { label: "Planning", links: [
    ["/dashboard/budget", ChartPie, "Monthly planner"],
    ["/dashboard/savings", PiggyBank, "Savings Intelligence"],
    ["/dashboard/goals", Target, "Goals"],
    ["/dashboard/emergency-fund", ShieldCheck, "Emergency Fund"],
  ] },
  { label: "Wealth", links: [
    ["/dashboard/net-worth", TrendingUp, "Net Worth"],
    ["/dashboard/gps", Compass, "Financial GPS"],
    ["/dashboard/financial-independence", Route, "Financial Independence"],
  ] },
  { label: "Intelligence", links: [
    ["/dashboard/insights", Sparkles, "Smart Insights"],
    ["/dashboard/documents", FileArchive, "Documents"],
  ] },
];

function isRouteActive(pathname: string, href: string): boolean {
  return href === "/dashboard/overview" || href === "/dashboard/admin"
    ? pathname === href
    : pathname.startsWith(href);
}

function fallbackDisplayName(user: SidebarUser): string {
  return user.displayName.trim() || user.email.split("@")[0]?.trim() || "Ficonter member";
}

export function Sidebar({ isAdmin = false, subscriptionPlanCode, user }: {
  isAdmin?: boolean;
  subscriptionPlanCode: SubscriptionPlanCode;
  user: SidebarUser;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const headerRef = useRef<HTMLElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const previousPathRef = useRef(pathname);
  const [previousAppPath, setPreviousAppPath] = useState<string | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [displayName, setDisplayName] = useState(() => fallbackDisplayName(user));
  const [accountEmail, setAccountEmail] = useState(user.email);
  const [avatarPath, setAvatarPath] = useState(user.avatarPath);
  const [avatarUrl, setAvatarUrl] = useState("");

  const groups = useMemo<readonly NavigationGroup[]>(() => {
    if (!isAdmin) return navigationGroups;
    return [...navigationGroups, { label: "Administration", links: [
      ["/dashboard/admin", ShieldCheck, "Admin"],
      ["/dashboard/admin/support", MessageSquareText, "Support inbox"],
    ] }];
  }, [isAdmin]);

  const avatarText = (displayName || accountEmail || "F").trim().slice(0, 1).toUpperCase();
  const accountAreaActive = ["/dashboard/profile", "/dashboard/setup", "/dashboard/settings", "/dashboard/help", "/dashboard/inbox"]
    .some((href) => pathname.startsWith(href));
  const businessLocked = !hasSubscriptionFeature(subscriptionPlanCode, "business_workspace");
  const businessHref = businessLocked
    ? getSubscriptionUpgradeHref("business_workspace")
    : "/business";
  const mobileRootPaths = new Set(["/dashboard", "/dashboard/overview", "/dashboard/transactions", "/dashboard/budget"]);
  const showBackCommand = !mobileRootPaths.has(pathname);
  const fallbackBackHref = "/dashboard/overview";

  useEffect(() => {
    const previous = previousPathRef.current;
    if (previous !== pathname) {
      if (previous.startsWith("/dashboard") || previous.startsWith("/business")) {
        setPreviousAppPath(previous);
      }
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  useEffect(() => {
    setPendingHref(null);
    setOpenGroup(null);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!pendingHref) return;
    const timer = window.setTimeout(() => setPendingHref(null), 8000);
    return () => window.clearTimeout(timer);
  }, [pendingHref]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenGroup(null);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadAvatar() {
      if (!avatarPath) { if (active) setAvatarUrl(""); return; }
      const { data, error } = await supabase.storage.from("profile-photos").createSignedUrl(avatarPath, 60 * 60);
      if (active) setAvatarUrl(error ? "" : data.signedUrl);
    }
    void loadAvatar();
    return () => { active = false; };
  }, [avatarPath, supabase]);

  useEffect(() => {
    function handleProfileUpdate(event: Event) {
      const detail = (event as CustomEvent<ProfileUpdatedDetail>).detail;
      if (typeof detail?.displayName === "string" || typeof detail?.fullName === "string") {
        setDisplayName(detail.displayName?.trim() || detail.fullName?.trim() || fallbackDisplayName({ ...user, email: accountEmail, displayName: "" }));
      }
      if (typeof detail?.profilePhotoPath === "string") setAvatarPath(detail.profilePhotoPath);
      if (typeof detail?.email === "string" && detail.email.trim()) setAccountEmail(detail.email.trim());
    }
    window.addEventListener("ficonter:profile-updated", handleProfileUpdate);
    return () => window.removeEventListener("ficonter:profile-updated", handleProfileUpdate);
  }, [accountEmail, user]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextEmail = session?.user.email?.trim();
      if (nextEmail) setAccountEmail(nextEmail);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    function openContactUs() { setMenuOpen(false); setContactOpen(true); }
    window.addEventListener(OPEN_CONTACT_EVENT, openContactUs);
    return () => window.removeEventListener(OPEN_CONTACT_EVENT, openContactUs);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setMenuOpen(false); }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function openRoute(href: string) {
    const targetPath = href.split("?")[0] || href;
    setMenuOpen(false);
    setOpenGroup(null);
    setPendingHref(pathname === targetPath ? null : targetPath);
    router.push(href);
  }

  function trackNavigation(href: string) {
    const targetPath = href.split("?")[0] || href;
    setOpenGroup(null);
    setPendingHref(pathname === targetPath ? null : targetPath);
  }

  function goBackInstant() {
    setMenuOpen(false);
    setOpenGroup(null);
    document.documentElement.removeAttribute("data-ficonter-route-loading");

    const target = previousAppPath && previousAppPath !== pathname
      ? previousAppPath
      : fallbackBackHref;

    router.prefetch(target);
    router.push(target, { scroll: false });
  }

  async function signOut(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (signingOut) return;
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) { setSigningOut(false); return; }
    router.replace("/");
    router.refresh();
  }

  return (
    <header className={styles.shellHeader} ref={headerRef}>
      <div className={styles.topRow}>
        <div className={styles.brandArea}>
          {showBackCommand ? (
            <button
              type="button"
              className={styles.mobileBackButton}
              onPointerDown={() => router.prefetch(previousAppPath || fallbackBackHref)}
              onClick={goBackInstant}
              aria-label="Go back"
              title="Back"
            >
              <ArrowLeft size={21} aria-hidden="true" />
            </button>
          ) : null}
          <div className={styles.brandCard}><Brand interactive={false} /></div>
          <span className={styles.workspacePill}><WalletCards size={15} />Personal<ChevronDown size={14} /></span>
        </div>
        <div className={styles.headerActions}>
          <LanguageSelector />
          <NotificationCenter isAdmin={isAdmin} />
          <div className={styles.accountDock} ref={accountRef}>
            {menuOpen ? (
              <div className={styles.accountMenu} role="menu" aria-label="Account menu">
                <button type="button" role="menuitem" onClick={() => openRoute("/dashboard/profile")}><UserRound size={17} /><span>Profile</span></button>
                <button type="button" role="menuitem" onClick={() => openRoute("/dashboard/settings")}><Settings2 size={17} /><span>Settings</span></button>
                <div className={styles.accountMenuDivider} />
                <button type="button" role="menuitem" className={styles.signOutItem} disabled={signingOut} onClick={signOut}><LogOut size={17} /><span>{signingOut ? "Logging out…" : "Log out"}</span></button>
              </div>
            ) : null}
            <button type="button" className={`${styles.accountButton}${accountAreaActive ? ` ${styles.accountButtonActive}` : ""}`} aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => setMenuOpen((open) => !open)}>
              <span className={styles.avatar} aria-hidden="true">{avatarUrl ? <img src={avatarUrl} alt="" /> : avatarText}</span>
              <span className={styles.accountIdentity}><strong>{displayName}</strong><small>{accountEmail}</small></span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
          <Link
            href={businessHref}
            className={styles.switchBusiness}
            aria-label={businessLocked ? "Switch to Business — Business Pro required" : "Switch to Business"}
            onClick={() => setOpenGroup(null)}
          >
            {businessLocked ? <LockKeyhole size={14} /> : <BriefcaseBusiness size={14} />}
            <span>Switch to Business</span>
          </Link>
        </div>
      </div>

      <nav className={styles.navigation} aria-label="Personal finance navigation">
        <Link href="/dashboard/overview" prefetch={false} className={`${styles.overviewLink}${isRouteActive(pathname, "/dashboard/overview") ? ` ${styles.activeLink}` : ""}`} aria-current={isRouteActive(pathname, "/dashboard/overview") ? "page" : undefined} onClick={() => trackNavigation("/dashboard/overview")}>
          <LayoutDashboard size={17} /><span>Overview</span>
        </Link>
        {groups.map((group) => {
          const groupActive = group.links.some(([href]) => isRouteActive(pathname, href));
          return (
            <details className={styles.navGroup} key={group.label} open={openGroup === group.label}>
              <summary
                className={groupActive ? styles.groupActive : undefined}
                aria-expanded={openGroup === group.label}
                onClick={(event) => {
                  event.preventDefault();
                  setOpenGroup((current) => current === group.label ? null : group.label);
                }}
              >{group.label}<ChevronDown size={14} /></summary>
              <div className={styles.groupMenu}>
                {group.links.map(([href, Icon, label]) => {
                  const feature = subscriptionFeatureForPersonalRoute(href);
                  const locked = Boolean(feature && !hasSubscriptionFeature(subscriptionPlanCode, feature));
                  const targetHref = locked && feature ? getSubscriptionUpgradeHref(feature) : href;
                  const active = !locked && isRouteActive(pathname, href);
                  return (
                    <Link href={targetHref} key={href} prefetch={false} className={active ? styles.activeMenuLink : undefined} aria-current={active ? "page" : undefined} aria-label={locked ? `${label} — upgrade required` : undefined} title={locked ? "Upgrade required" : undefined} onClick={() => trackNavigation(targetHref)}>
                      <Icon size={17} /><span>{label}</span>{locked ? <LockKeyhole size={13} /> : null}
                    </Link>
                  );
                })}
              </div>
            </details>
          );
        })}
        <Link href="/dashboard/settings" prefetch={false} className={`${styles.settingsLink}${isRouteActive(pathname, "/dashboard/settings") ? ` ${styles.activeLink}` : ""}`} aria-current={isRouteActive(pathname, "/dashboard/settings") ? "page" : undefined} onClick={() => trackNavigation("/dashboard/settings")}>
          <span>Settings</span>
        </Link>
      </nav>

      <div className={`${styles.progress}${pendingHref ? ` ${styles.progressVisible}` : ""}`} aria-hidden="true"><span /></div>
      <ContactSupportModal open={contactOpen} defaultEmail={accountEmail} onClose={() => setContactOpen(false)} />
    </header>
  );
}
