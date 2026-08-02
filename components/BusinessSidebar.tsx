"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  LayoutDashboard,
  LogOut,
  PackageOpen,
  ShoppingCart,
  Truck,
  WalletCards,
} from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Business } from "@/lib/business/types";
import { Brand } from "./Brand";
import styles from "./BusinessSidebar.module.css";

const links = [
  ["/business/overview", LayoutDashboard, "Overview"],
  ["/business/transactions", ArrowLeftRight, "Transactions"],
  ["/business/cost-control", BarChart3, "Cost Control"],
  ["/business/suppliers", Truck, "Suppliers"],
  ["/business/inventory", PackageOpen, "Inventory"],
  ["/business/sales", ShoppingCart, "Sales"],
] as const;

function activeRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BusinessSidebar({
  business,
  user,
}: {
  business: Business | null;
  user: { displayName: string; email: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [signingOut, setSigningOut] = useState(false);
  const displayName = user.displayName.trim() || user.email.split("@")[0] || "Member";

  async function signOut(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (signingOut) return;
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSigningOut(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <aside className={`sidebar ${styles.sidebar}`}>
      <Brand href="/business" />

      <section className={styles.businessIdentity}>
        <span><Building2 size={15} /> Business workspace</span>
        <strong>{business?.name ?? "Business setup"}</strong>
        <small>{business ? `${business.business_type} · ${business.base_currency}` : "Create your isolated business workspace"}</small>
      </section>

      <nav className={`side-nav ${styles.navigation}`} aria-label="Business navigation">
        <span className={styles.sectionLabel}>Business</span>
        {business ? links.map(([href, Icon, label]) => (
          <Link
            href={href}
            key={href}
            className={`side-link ${activeRoute(pathname, href) ? "active" : ""}`}
            aria-current={activeRoute(pathname, href) ? "page" : undefined}
            prefetch={false}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        )) : (
          <Link
            href="/business/setup"
            className={`side-link ${activeRoute(pathname, "/business/setup") ? "active" : ""}`}
            prefetch={false}
          >
            <Building2 size={18} aria-hidden="true" />
            <span>Create business</span>
          </Link>
        )}
      </nav>

      <div className={styles.bottomDock}>
        <Link href="/dashboard" className={styles.personalLink}>
          <WalletCards size={17} />
          Personal workspace
        </Link>
        <div className={styles.account}>
          <span>{displayName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{displayName}</strong>
            <small>{user.email}</small>
          </div>
          <button onClick={signOut} disabled={signingOut} aria-label="Log out">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
