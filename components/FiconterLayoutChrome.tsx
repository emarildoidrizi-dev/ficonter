"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  CircleDollarSign,
  Gauge,
  Goal,
  LayoutDashboard,
  ListChecks,
  PackageOpen,
  PiggyBank,
  ReceiptText,
  Sparkles,
  WalletCards,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import styles from "./FiconterLayoutShell.module.css";

export type LayoutWorkspace = "personal" | "business";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const PERSONAL_PRIMARY: NavItem[] = [
  { href: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Money", icon: WalletCards },
  { href: "/dashboard/budget", label: "Planning", icon: ListChecks },
  { href: "/dashboard/net-worth", label: "Wealth", icon: ChartNoAxesCombined },
  { href: "/business", label: "Business", icon: BriefcaseBusiness },
];

const BUSINESS_PRIMARY: NavItem[] = [
  { href: "/business/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/business/transactions", label: "Operations", icon: WalletCards },
  { href: "/business/inventory", label: "Inventory", icon: PackageOpen },
  { href: "/business/sales", label: "Sales", icon: CircleDollarSign },
  { href: "/business/reports", label: "Reports", icon: BarChart3 },
  { href: "/business/admin", label: "Admin", icon: Building2 },
];


const PERSONAL_RAIL: NavItem[] = [
  { href: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transactions", icon: WalletCards },
  { href: "/dashboard/bills", label: "Bills", icon: ReceiptText },
  { href: "/dashboard/credit-cards", label: "Credit Cards", icon: CircleDollarSign },
  { href: "/dashboard/debt", label: "Debts", icon: PiggyBank },
  { href: "/dashboard/cash-flow", label: "Cash Flow", icon: Gauge },
  { href: "/dashboard/budget", label: "Planner", icon: ListChecks },
  { href: "/dashboard/savings", label: "Savings", icon: PiggyBank },
  { href: "/dashboard/goals", label: "Goals", icon: Goal },
  { href: "/dashboard/net-worth", label: "Net Worth", icon: ChartNoAxesCombined },
  { href: "/dashboard/gps", label: "Financial GPS", icon: Gauge },
  { href: "/dashboard/insights", label: "Insights", icon: Sparkles },
];

const BUSINESS_RAIL: NavItem[] = [
  { href: "/business/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/business/transactions", label: "Transactions", icon: WalletCards },
  { href: "/business/cost-control", label: "Cost Control", icon: PiggyBank },
  { href: "/business/suppliers", label: "Suppliers", icon: BriefcaseBusiness },
  { href: "/business/inventory", label: "Inventory", icon: PackageOpen },
  { href: "/business/sales", label: "Sales", icon: CircleDollarSign },
  { href: "/business/reports", label: "Reports", icon: BarChart3 },
];

const PERSONAL_TABS: NavItem[] = [
  { href: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/cash-flow", label: "Cash Flow", icon: Gauge },
  { href: "/dashboard/budget", label: "Planner", icon: ListChecks },
  { href: "/dashboard/goals", label: "Goals", icon: Goal },
  { href: "/dashboard/insights", label: "Insights", icon: Sparkles },
];

const BUSINESS_TABS: NavItem[] = [
  { href: "/business/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/business/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/business/cost-control", label: "Cost Control", icon: PiggyBank },
  { href: "/business/inventory", label: "Inventory", icon: PackageOpen },
  { href: "/business/reports", label: "Reports", icon: BarChart3 },
];

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/dashboard/overview" && pathname === "/dashboard") return true;
  if (href === "/business/overview" && pathname === "/business") return true;
  return pathname.startsWith(`${href}/`);
}

export function FiconterTopNavigation({
  workspace,
  workspaceSwitcher,
  compact = false,
}: {
  workspace: LayoutWorkspace;
  workspaceSwitcher: React.ReactNode;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const links = workspace === "business" ? BUSINESS_PRIMARY : PERSONAL_PRIMARY;

  return (
    <header className={`${styles.topNavigation} ${compact ? styles.topNavigationCompact : ""}`}>
      <div className={styles.topBrand}>
        <Brand href={workspace === "business" ? "/business/overview" : "/dashboard/overview"} />
      </div>
      <nav className={styles.topPrimaryLinks} aria-label="Ficonter layout navigation">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            href={href}
            key={href}
            className={isActive(pathname, href) ? styles.topLinkActive : styles.topLink}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className={styles.topWorkspaceSwitcher}>{workspaceSwitcher}</div>
    </header>
  );
}

export function FiconterSectionTabs({ workspace }: { workspace: LayoutWorkspace }) {
  const pathname = usePathname();
  const links = workspace === "business" ? BUSINESS_TABS : PERSONAL_TABS;

  return (
    <nav className={styles.sectionTabs} aria-label="Current workspace sections">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          href={href}
          key={href}
          className={isActive(pathname, href) ? styles.sectionTabActive : styles.sectionTab}
        >
          <Icon size={16} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}


export function FiconterRailNavigation({
  workspace,
  drawerOpen,
  onToggleDrawer,
}: {
  workspace: LayoutWorkspace;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}) {
  const pathname = usePathname();
  const links = workspace === "business" ? BUSINESS_RAIL : PERSONAL_RAIL;

  return (
    <nav className={styles.railNavigation} aria-label="Compact Ficonter navigation">
      <Link
        className={styles.railMark}
        href={workspace === "business" ? "/business/overview" : "/dashboard/overview"}
        aria-label="Ficonter overview"
      >
        F
      </Link>
      <div className={styles.railLinks}>
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            href={href}
            key={href}
            title={label}
            aria-label={label}
            className={isActive(pathname, href) ? styles.railLinkActive : styles.railLink}
          >
            <Icon size={18} aria-hidden="true" />
          </Link>
        ))}
      </div>
      <div className={styles.railBottom}>
        <Link
          href={workspace === "business" ? "/business/manage" : "/dashboard/settings"}
          className={styles.railLink}
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={18} aria-hidden="true" />
        </Link>
        <button
          type="button"
          className={drawerOpen ? styles.railLinkActive : styles.railLink}
          onClick={onToggleDrawer}
          aria-expanded={drawerOpen}
          aria-label={drawerOpen ? "Close full navigation" : "Open full navigation"}
          title={drawerOpen ? "Close navigation" : "Open full navigation"}
        >
          {drawerOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </nav>
  );
}
