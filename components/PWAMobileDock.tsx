"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarRange,
  House,
  ReceiptText,
  Settings2,
  ShoppingBag,
} from "lucide-react";
import styles from "./PWAMobileDock.module.css";

type Workspace = "personal" | "business";

type DockItem = {
  href: string;
  label: string;
  icon: typeof House;
  exact?: boolean;
};

const personalItems: DockItem[] = [
  { href: "/dashboard", label: "Home", icon: House, exact: true },
  { href: "/dashboard/transactions", label: "Activity", icon: ReceiptText },
  { href: "/dashboard/budget", label: "Plan", icon: CalendarRange },
  { href: "/dashboard/settings", label: "Settings", icon: Settings2 },
];

const businessItems: DockItem[] = [
  { href: "/business/overview", label: "Home", icon: House, exact: true },
  { href: "/business/sales", label: "Sales", icon: ShoppingBag },
  { href: "/business/transactions", label: "Activity", icon: ReceiptText },
  { href: "/business/reports", label: "Reports", icon: BarChart3 },
];

function active(pathname: string, item: DockItem, workspace: Workspace) {
  if (item.exact) {
    return workspace === "business"
      ? pathname === "/business" || pathname === "/business/overview"
      : pathname === "/dashboard";
  }
  return pathname.startsWith(item.href);
}

export function PWAMobileDock({ workspace }: { workspace: Workspace }) {
  const pathname = usePathname();
  const items = workspace === "business" ? businessItems : personalItems;

  return (
    <nav className={styles.dock} aria-label={`${workspace} mobile app navigation`}>
      {items.map((item) => {
        const Icon = item.icon;
        const selected = active(pathname, item, workspace);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.item} ${selected ? styles.active : ""}`}
            aria-current={selected ? "page" : undefined}
          >
            <span className={styles.icon}>
              <Icon size={21} strokeWidth={2.1} aria-hidden="true" />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
