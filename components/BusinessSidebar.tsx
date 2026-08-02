"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeftRight,
  BarChart3,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  PackageOpen,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Truck,
  WalletCards,
} from "lucide-react";
import {
  useMemo,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Business } from "@/lib/business/types";
import { Brand } from "./Brand";
import styles from "./BusinessSidebar.module.css";

const links = [
  ["/business/overview", LayoutDashboard, "Overview", false],
  ["/business/transactions", ArrowLeftRight, "Transactions", false],
  ["/business/cost-control", BarChart3, "Cost Control", false],
  ["/business/suppliers", Truck, "Suppliers", false],
  ["/business/inventory", PackageOpen, "Inventory", false],
  ["/business/sales", ShoppingCart, "Sales", false],
  ["/business/reports", FileText, "Reports", false],
  ["/business/administration", ShieldCheck, "Administration", true],
  ["/business/manage", Settings2, "Businesses", false],
] as const;

function activeRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BusinessSidebar({
  businesses,
  business,
  canManage,
  user,
}: {
  businesses: Business[];
  business: Business | null;
  canManage: boolean;
  user: { displayName: string; email: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [signingOut, setSigningOut] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const displayName =
    user.displayName.trim() || user.email.split("@")[0] || "Member";
  const businessLogoUrl = business?.logo_path
    ? supabase.storage
        .from("business-assets")
        .getPublicUrl(business.logo_path).data.publicUrl
    : "";
  const activeBusinesses = businesses.filter(
    (item) => item.status !== "archived",
  );
  const archivedCount = businesses.length - activeBusinesses.length;

  async function switchBusiness(event: ChangeEvent<HTMLSelectElement>) {
    const nextBusinessId = event.target.value;
    if (
      !nextBusinessId ||
      nextBusinessId === business?.id ||
      switching
    ) {
      return;
    }

    setSwitching(true);
    setSwitchError("");

    const { error } = await supabase.rpc("set_active_business_workspace", {
      p_business_id: nextBusinessId,
    });

    if (error) {
      setSwitchError(error.message);
      setSwitching(false);
      return;
    }

    router.refresh();
    setSwitching(false);
  }

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
        <span className={styles.workspaceLabel}>
          {businessLogoUrl ? (
            <img
              className={styles.sidebarBusinessLogo}
              src={businessLogoUrl}
              alt=""
            />
          ) : (
            <Building2 size={15} />
          )}
          Business workspace
        </span>

        {business ? (
          <>
            <label className={styles.businessSelector}>
              <span>Active business</span>
              <select
                value={business.id}
                onChange={switchBusiness}
                disabled={switching}
                aria-label="Select active business"
              >
                {activeBusinesses.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <small>
              {business.business_type} · {business.base_currency}
            </small>
            {switchError ? (
              <small className={styles.switchError}>{switchError}</small>
            ) : null}
          </>
        ) : (
          <>
            <strong>No active business</strong>
            <small>
              Restore an archived workspace or create another business.
            </small>
          </>
        )}

        {archivedCount ? (
          <small className={styles.archiveNotice}>
            <Archive size={13} />
            {archivedCount} archived
          </small>
        ) : null}

        <Link href="/business/manage" className={styles.manageBusinesses}>
          <Settings2 size={15} />
          Manage businesses
        </Link>
      </section>

      <nav
        className={`side-nav ${styles.navigation}`}
        aria-label="Business navigation"
      >
        <span className={styles.sectionLabel}>Business</span>

        {business
          ? links
              .filter(([, , , adminOnly]) => !adminOnly || canManage)
              .map(([href, Icon, label]) => (
              <Link
                href={href}
                key={href}
                className={`side-link ${
                  activeRoute(pathname, href) ? "active" : ""
                }`}
                aria-current={
                  activeRoute(pathname, href) ? "page" : undefined
                }
                prefetch={false}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))
          : (
              <>
                <Link
                  href="/business/manage"
                  className={`side-link ${
                    activeRoute(pathname, "/business/manage") ? "active" : ""
                  }`}
                  prefetch={false}
                >
                  <Settings2 size={18} aria-hidden="true" />
                  <span>Businesses</span>
                </Link>
                <Link
                  href="/business/setup"
                  className={`side-link ${
                    activeRoute(pathname, "/business/setup") ? "active" : ""
                  }`}
                  prefetch={false}
                >
                  <Building2 size={18} aria-hidden="true" />
                  <span>Create business</span>
                </Link>
              </>
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
