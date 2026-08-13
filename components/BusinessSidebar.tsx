"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive, ArrowLeftRight, BarChart3, Building2, ChevronDown, FileText,
  LayoutDashboard, LogOut, PackageOpen, Settings2, ShieldCheck,
  ShoppingCart, Truck, UserRound, Users, WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type MouseEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Business } from "@/lib/business/types";
import { switchActiveBusinessAction } from "@/app/business/actions";
import { Brand } from "./Brand";
import { LanguageSelector } from "./LanguageSelector";
import { NotificationCenter } from "./NotificationCenter";
import styles from "./BusinessSidebar.module.css";

type BusinessLink = readonly [href: string, icon: LucideIcon, label: string, manageOnly?: boolean, platformOnly?: boolean];
type BusinessGroup = { label: string; links: readonly BusinessLink[] };

const groups: readonly BusinessGroup[] = [
  { label: "Operations", links: [
    ["/business/transactions", ArrowLeftRight, "Transactions"],
    ["/business/sales", ShoppingCart, "Sales"],
    ["/business/inventory", PackageOpen, "Inventory"],
  ] },
  { label: "Control", links: [
    ["/business/cost-control", BarChart3, "Cost Control"],
    ["/business/suppliers", Truck, "Suppliers"],
  ] },
  { label: "Intelligence", links: [["/business/reports", FileText, "Reports"]] },
  { label: "Administration", links: [
    ["/business/administration", ShieldCheck, "Administration", true, false],
    ["/business/manage", Settings2, "Manage businesses"],
    ["/business/admin", Users, "Business Admin", false, true],
  ] },
];

function activeRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BusinessSidebar({ businesses, business, canManage, isPlatformAdmin, user }: {
  businesses: Business[];
  business: Business | null;
  canManage: boolean;
  isPlatformAdmin: boolean;
  user: { displayName: string; email: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const headerRef = useRef<HTMLElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [selectedBusinessId, setSelectedBusinessId] = useState(business?.id ?? "");
  const [pendingBusinessId, setPendingBusinessId] = useState("");
  const [switchTransitionPending, startSwitchTransition] = useTransition();
  const displayName = user.displayName.trim() || user.email.split("@")[0] || "Member";
  const businessLogoUrl = business?.logo_path
    ? supabase.storage.from("business-assets").getPublicUrl(business.logo_path).data.publicUrl
    : "";
  const activeBusinesses = businesses.filter((item) => item.status !== "archived");
  const archivedCount = businesses.length - activeBusinesses.length;

  useEffect(() => {
    setSelectedBusinessId(business?.id ?? "");
    if (pendingBusinessId && business?.id === pendingBusinessId) setPendingBusinessId("");
  }, [business?.id, pendingBusinessId]);

  useEffect(() => {
    setPendingHref(null);
    setOpenGroup(null);
    setAccountMenuOpen(false);
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
    if (!accountMenuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!pendingBusinessId || business?.id === pendingBusinessId) return;
    const fallbackId = window.setTimeout(() => window.location.replace(window.location.href), 1800);
    return () => window.clearTimeout(fallbackId);
  }, [business?.id, pendingBusinessId]);

  async function switchBusiness(event: ChangeEvent<HTMLSelectElement>) {
    const nextBusinessId = event.target.value;
    if (!nextBusinessId || nextBusinessId === business?.id || switching || switchTransitionPending) return;
    const previousBusinessId = selectedBusinessId || business?.id || "";
    setSelectedBusinessId(nextBusinessId);
    setSwitching(true);
    setSwitchError("");
    const result = await switchActiveBusinessAction(nextBusinessId);
    if (!result.ok) {
      setSelectedBusinessId(previousBusinessId);
      setSwitchError(result.error);
      setSwitching(false);
      return;
    }
    setPendingBusinessId(nextBusinessId);
    setSwitching(false);
    startSwitchTransition(() => router.refresh());
  }

  async function signOut(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (signingOut) return;
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) { setSigningOut(false); return; }
    router.replace("/");
    router.refresh();
  }

  function trackRoute(href: string) {
    const targetPath = href.split("?")[0] || href;
    setAccountMenuOpen(false);
    setOpenGroup(null);
    setPendingHref(pathname === targetPath ? null : targetPath);
  }

  return (
    <header className={styles.shellHeader} ref={headerRef}>
      <div className={styles.topRow}>
        <div className={styles.brandArea}>
          <div className={styles.brandCard}><Brand href="/business/overview" /></div>
          <span className={styles.workspacePill}><Building2 size={15} />Business<ChevronDown size={14} /></span>
        </div>

        <div className={styles.businessIdentity}>
          <span className={styles.businessMark} aria-hidden="true">
            {businessLogoUrl ? <img src={businessLogoUrl} alt="" /> : <Building2 size={17} />}
          </span>
          {business ? (
            <label className={styles.businessSelector}>
              <span>Active business</span>
              <select value={selectedBusinessId || business.id} onChange={switchBusiness} disabled={switching || switchTransitionPending} aria-label="Select active business">
                {activeBusinesses.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
            </label>
          ) : <Link className={styles.createLink} href="/business/setup">Create business</Link>}
          {pendingBusinessId ? <small className={styles.status}>Updating…</small> : null}
          {switchError ? <small className={styles.switchError}>{switchError}</small> : null}
          {archivedCount ? <span className={styles.archiveNotice}><Archive size={12} />{archivedCount} archived</span> : null}
        </div>

        <div className={styles.headerActions}>
          <LanguageSelector />
          <NotificationCenter isAdmin={isPlatformAdmin} />
          <div className={styles.accountDock} ref={accountRef}>
            {accountMenuOpen ? (
              <div className={styles.accountMenu} role="menu" aria-label="Account menu">
                <Link href="/dashboard/settings?section=profile" role="menuitem" onClick={() => trackRoute("/dashboard/settings?section=profile")}><UserRound size={17} /><span>Profile</span></Link>
                <Link href="/business/manage" role="menuitem" onClick={() => trackRoute("/business/manage")}><Settings2 size={17} /><span>Manage businesses</span></Link>
                <div className={styles.accountMenuDivider} />
                <button type="button" role="menuitem" className={styles.signOutItem} onClick={signOut} disabled={signingOut}><LogOut size={17} /><span>{signingOut ? "Logging out…" : "Log out"}</span></button>
              </div>
            ) : null}
            <button type="button" className={styles.accountButton} aria-expanded={accountMenuOpen} aria-haspopup="menu" onClick={() => setAccountMenuOpen((open) => !open)}>
              <span className={styles.avatar}>{displayName.slice(0, 1).toUpperCase()}</span>
              <span className={styles.accountText}><strong>{displayName}</strong><small>{user.email}</small></span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
          <Link href="/dashboard/overview" className={styles.switchPersonal} aria-label="Switch to Personal" title="Switch to Personal" onClick={() => trackRoute("/dashboard/overview")}><WalletCards size={14} /><span>Switch to Personal</span></Link>
        </div>
      </div>

      <nav className={styles.navigation} aria-label="Business navigation">
        {business ? (
          <>
            <Link href="/business/overview" className={`${styles.overviewLink}${activeRoute(pathname, "/business/overview") ? ` ${styles.activeLink}` : ""}`} aria-current={activeRoute(pathname, "/business/overview") ? "page" : undefined} prefetch={false} onClick={() => trackRoute("/business/overview")}><LayoutDashboard size={17} />Overview</Link>
            {groups.map((group) => {
              const visibleLinks = group.links.filter(([, , , manageOnly, platformOnly]) => (!manageOnly || canManage) && (!platformOnly || isPlatformAdmin));
              if (!visibleLinks.length) return null;
              const groupActive = visibleLinks.some(([href]) => activeRoute(pathname, href));
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
                    {visibleLinks.map(([href, Icon, label]) => <Link href={href} key={href} className={activeRoute(pathname, href) ? styles.activeMenuLink : undefined} aria-current={activeRoute(pathname, href) ? "page" : undefined} prefetch={false} onClick={() => trackRoute(href)}><Icon size={17} /><span>{label}</span></Link>)}
                  </div>
                </details>
              );
            })}
          </>
        ) : (
          <>
            <Link href="/business/setup" className={styles.overviewLink}><Building2 size={17} />Create business</Link>
            <Link href="/business/manage" className={styles.overviewLink}><Settings2 size={17} />Manage businesses</Link>
            {isPlatformAdmin ? <Link href="/business/admin" className={styles.overviewLink}><Users size={17} />Business Admin</Link> : null}
          </>
        )}
      </nav>
      <div className={`${styles.progress}${pendingHref ? ` ${styles.progressVisible}` : ""}`} aria-hidden="true"><span /></div>
    </header>
  );
}
