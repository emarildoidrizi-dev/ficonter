"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive, ArrowLeftRight, BarChart3, Building2, ChevronDown, FileText,
  LayoutDashboard, LogOut, PackageOpen, Settings2, ShieldCheck,
  ShoppingCart, Truck, Users, WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, useTransition, type ChangeEvent, type MouseEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Business } from "@/lib/business/types";
import { switchActiveBusinessAction } from "@/app/business/actions";
import { Brand } from "./Brand";
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
  const [signingOut, setSigningOut] = useState(false);
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

  return (
    <header className={styles.shellHeader}>
      <div className={styles.topRow}>
        <div className={styles.brandArea}>
          <Brand href="/business/overview" />
          <span className={styles.workspacePill}>Business</span>
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

        <div className={styles.account}>
          <span className={styles.avatar}>{displayName.slice(0, 1).toUpperCase()}</span>
          <span className={styles.accountText}><strong>{displayName}</strong><small>{user.email}</small></span>
          <Link href="/dashboard/overview" aria-label="Personal workspace" title="Personal workspace"><WalletCards size={17} /></Link>
          <button onClick={signOut} disabled={signingOut} aria-label="Log out"><LogOut size={17} /></button>
        </div>
      </div>

      <nav className={styles.navigation} aria-label="Business navigation">
        {business ? (
          <>
            <Link href="/business/overview" className={`${styles.overviewLink}${activeRoute(pathname, "/business/overview") ? ` ${styles.activeLink}` : ""}`} aria-current={activeRoute(pathname, "/business/overview") ? "page" : undefined} prefetch={false}><LayoutDashboard size={17} />Overview</Link>
            {groups.map((group) => {
              const visibleLinks = group.links.filter(([, , , manageOnly, platformOnly]) => (!manageOnly || canManage) && (!platformOnly || isPlatformAdmin));
              if (!visibleLinks.length) return null;
              const groupActive = visibleLinks.some(([href]) => activeRoute(pathname, href));
              return (
                <details className={styles.navGroup} key={group.label}>
                  <summary className={groupActive ? styles.groupActive : undefined}>{group.label}<ChevronDown size={14} /></summary>
                  <div className={styles.groupMenu}>
                    {visibleLinks.map(([href, Icon, label]) => <Link href={href} key={href} className={activeRoute(pathname, href) ? styles.activeMenuLink : undefined} aria-current={activeRoute(pathname, href) ? "page" : undefined} prefetch={false}><Icon size={17} /><span>{label}</span></Link>)}
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
    </header>
  );
}
