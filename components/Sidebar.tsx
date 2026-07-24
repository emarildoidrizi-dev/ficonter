"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  ChartPie,
  CreditCard,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShieldCheck,
  Target,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Brand } from "./Brand";
import { SignOutButton } from "./SignOutButton";
import styles from "./SidebarNavigation.module.css";

const standardLinks = [
  ["/dashboard", LayoutDashboard, "Overview"],
  ["/dashboard/transactions", ArrowLeftRight, "Transactions"],
  ["/dashboard/bills", ReceiptText, "Bills"],
  ["/dashboard/budget", ChartPie, "Monthly planner"],
  ["/dashboard/goals", Target, "Goals"],
  ["/dashboard/debt", CreditCard, "Debt"],
  ["/dashboard/net-worth", Landmark, "Net worth"],
  ["/dashboard/settings", Settings, "Settings"],
] as const;

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const links = useMemo(
    () =>
      isAdmin
        ? [
            ...standardLinks.slice(0, -1),
            ["/dashboard/admin", ShieldCheck, "Admin"] as const,
            standardLinks.at(-1)!,
          ]
        : standardLinks,
    [isAdmin],
  );

  useEffect(() => setPendingHref(null), [pathname]);

  useEffect(() => {
    if (!pendingHref) return;
    const timer = window.setTimeout(() => setPendingHref(null), 8000);
    return () => window.clearTimeout(timer);
  }, [pendingHref]);

  return (
    <aside className="sidebar">
      <Brand href="/dashboard" />
      <nav className="side-nav" aria-label="Private finance navigation">
        {links.map(([href, Icon, label]) => {
          const active =
            href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          const pending = pendingHref === href;

          return (
            <Link
              className={`side-link ${styles.link}${active ? " active" : ""}${
                pending ? ` ${styles.pending}` : ""
              }`}
              href={href}
              key={href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (!active) setPendingHref(href);
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              {pending ? (
                <span className={styles.spinner} aria-label="Opening page" />
              ) : null}
            </Link>
          );
        })}
        <SignOutButton />
      </nav>

      <div
        className={`${styles.progress}${
          pendingHref ? ` ${styles.progressVisible}` : ""
        }`}
        aria-hidden="true"
      >
        <span />
      </div>
    </aside>
  );
}
