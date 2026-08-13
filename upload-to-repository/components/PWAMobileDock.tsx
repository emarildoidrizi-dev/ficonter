"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, ArrowLeftRight, BarChart3, Building2, CalendarRange, ChartPie,
  CircleHelp, Compass, CreditCard, FileArchive, FileText, House, Landmark,
  LayoutGrid, LockKeyhole, PackageOpen, PiggyBank, ReceiptText, Route,
  Settings2, ShieldCheck, ShoppingBag, Target, TrendingUp, Truck, Users,
  WalletCards, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { getSubscriptionUpgradeHref, subscriptionFeatureForPersonalRoute } from "@/lib/subscriptionNavigation";
import { hasSubscriptionFeature, type SubscriptionPlanCode } from "@/lib/subscriptionPlans";
import styles from "./PWAMobileDock.module.css";

type Workspace = "personal" | "business";
type DockItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
type MenuItem = { href: string; label: string; icon: LucideIcon; manageOnly?: boolean; platformOnly?: boolean };

const personalItems: DockItem[] = [
  { href: "/dashboard/overview", label: "Overview", icon: House, exact: true },
  { href: "/dashboard/transactions", label: "Activity", icon: ReceiptText },
  { href: "/dashboard/bills", label: "Bills", icon: CreditCard },
  { href: "/dashboard/budget", label: "Plan", icon: CalendarRange },
];
const businessItems: DockItem[] = [
  { href: "/business/overview", label: "Overview", icon: House, exact: true },
  { href: "/business/sales", label: "Sales", icon: ShoppingBag },
  { href: "/business/transactions", label: "Activity", icon: ReceiptText },
  { href: "/business/reports", label: "Reports", icon: BarChart3 },
];

const personalSections: { label: string; links: MenuItem[] }[] = [
  { label: "Money", links: [
    { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
    { href: "/dashboard/bills", label: "Bills", icon: ReceiptText },
    { href: "/dashboard/credit-cards", label: "Credit Cards", icon: CreditCard },
    { href: "/dashboard/debt", label: "Debts", icon: Landmark },
    { href: "/dashboard/cash-flow", label: "Cash flow", icon: Activity },
  ] },
  { label: "Planning", links: [
    { href: "/dashboard/budget", label: "Monthly planner", icon: ChartPie },
    { href: "/dashboard/savings", label: "Savings Intelligence", icon: PiggyBank },
    { href: "/dashboard/goals", label: "Goals", icon: Target },
    { href: "/dashboard/emergency-fund", label: "Emergency Fund", icon: ShieldCheck },
  ] },
  { label: "Wealth & intelligence", links: [
    { href: "/dashboard/net-worth", label: "Net Worth", icon: TrendingUp },
    { href: "/dashboard/gps", label: "Financial GPS", icon: Compass },
    { href: "/dashboard/financial-independence", label: "Financial Independence", icon: Route },
    { href: "/dashboard/insights", label: "Smart Insights", icon: LayoutGrid },
    { href: "/dashboard/documents", label: "Documents", icon: FileArchive },
  ] },
  { label: "Workspace", links: [
    { href: "/dashboard/settings", label: "Settings", icon: Settings2 },
    { href: "/dashboard/help", label: "Help", icon: CircleHelp },
    { href: "/business/overview", label: "Business workspace", icon: Building2 },
  ] },
];

const businessSections: { label: string; links: MenuItem[] }[] = [
  { label: "Operations", links: [
    { href: "/business/transactions", label: "Transactions", icon: ArrowLeftRight },
    { href: "/business/sales", label: "Sales", icon: ShoppingBag },
    { href: "/business/inventory", label: "Inventory", icon: PackageOpen },
  ] },
  { label: "Control & intelligence", links: [
    { href: "/business/cost-control", label: "Cost Control", icon: BarChart3 },
    { href: "/business/suppliers", label: "Suppliers", icon: Truck },
    { href: "/business/reports", label: "Reports", icon: FileText },
  ] },
  { label: "Workspace", links: [
    { href: "/business/administration", label: "Administration", icon: ShieldCheck, manageOnly: true },
    { href: "/business/manage", label: "Manage businesses", icon: Settings2 },
    { href: "/business/admin", label: "Business Admin", icon: Users, platformOnly: true },
    { href: "/dashboard/overview", label: "Personal workspace", icon: WalletCards },
  ] },
];

function active(pathname: string, item: DockItem, workspace: Workspace) {
  if (item.exact) return workspace === "business"
    ? pathname === "/business" || pathname === "/business/overview"
    : pathname === "/dashboard" || pathname === "/dashboard/overview";
  return pathname.startsWith(item.href);
}

export function PWAMobileDock({
  workspace,
  subscriptionPlanCode,
  isAdmin = false,
  canManage = false,
  isPlatformAdmin = false,
}: {
  workspace: Workspace;
  subscriptionPlanCode: SubscriptionPlanCode;
  isAdmin?: boolean;
  canManage?: boolean;
  isPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = workspace === "business" ? businessItems : personalItems;
  const sections = workspace === "business" ? businessSections : personalSections;

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      {open ? (
        <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className={styles.sheet} role="dialog" aria-modal="true" aria-label={`${workspace} navigation`}>
            <header><div><span>FICONTER</span><strong>All {workspace} modules</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button></header>
            <div className={styles.sections}>
              {sections.map((section) => {
                const links = section.links.filter((item) => (!item.manageOnly || canManage) && (!item.platformOnly || isPlatformAdmin));
                if (workspace === "personal" && section.label === "Workspace" && isAdmin) {
                  links.splice(2, 0, { href: "/dashboard/admin", label: "Administration", icon: ShieldCheck });
                }
                return (
                  <section className={styles.section} key={section.label}>
                    <h2>{section.label}</h2>
                    <div className={styles.menuGrid}>
                      {links.map((item) => {
                        const feature = workspace === "personal"
                          ? (item.href.startsWith("/business") ? "business_workspace" : subscriptionFeatureForPersonalRoute(item.href))
                          : null;
                        const locked = Boolean(feature && !hasSubscriptionFeature(subscriptionPlanCode, feature));
                        const href = locked && feature ? getSubscriptionUpgradeHref(feature) : item.href;
                        const Icon = item.icon;
                        return <Link href={href} key={item.href} className={pathname.startsWith(item.href) ? styles.current : undefined} aria-label={locked ? `${item.label} — upgrade required` : undefined}><span><Icon size={19} /></span><strong>{item.label}</strong>{locked ? <LockKeyhole size={13} /> : null}</Link>;
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      <nav className={styles.dock} aria-label={`${workspace} mobile app navigation`}>
        {items.map((item) => {
          const Icon = item.icon;
          const selected = active(pathname, item, workspace);
          const feature = workspace === "personal" ? subscriptionFeatureForPersonalRoute(item.href) : null;
          const locked = Boolean(feature && !hasSubscriptionFeature(subscriptionPlanCode, feature));
          const href = locked && feature ? getSubscriptionUpgradeHref(feature) : item.href;
          return <Link key={item.href} href={href} className={`${styles.item} ${selected ? styles.active : ""}`} aria-current={selected ? "page" : undefined}><span className={styles.icon}><Icon size={20} strokeWidth={2.1} /></span><span>{item.label}</span></Link>;
        })}
        <button type="button" className={`${styles.item} ${open ? styles.active : ""}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)}><span className={styles.icon}><LayoutGrid size={20} strokeWidth={2.1} /></span><span>More</span></button>
      </nav>
    </>
  );
}
