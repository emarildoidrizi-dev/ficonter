"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  ChartPie,
  ChevronUp,
  CreditCard,
  Landmark,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { Brand } from "./Brand";
import styles from "./SidebarNavigation.module.css";

type SidebarUser = {
  displayName: string;
  email: string;
  avatarPath: string;
};

type ProfileUpdatedDetail = {
  displayName?: string;
  fullName?: string;
  profilePhotoPath?: string;
};

const standardLinks = [
  ["/dashboard", LayoutDashboard, "Overview"],
  ["/dashboard/transactions", ArrowLeftRight, "Transactions"],
  ["/dashboard/budget", ChartPie, "Monthly planner"],
  ["/dashboard/bills", ReceiptText, "Bills"],
  ["/dashboard/debt", CreditCard, "Debt"],
  ["/dashboard/goals", Target, "Goals"],
  ["/dashboard/net-worth", Landmark, "Net worth"],
] as const;

function fallbackDisplayName(user: SidebarUser): string {
  const provided = user.displayName.trim();
  if (provided) return provided;

  const emailName = user.email.split("@")[0]?.trim();
  return emailName || "Ficonter member";
}

export function Sidebar({
  isAdmin = false,
  user,
}: {
  isAdmin?: boolean;
  user: SidebarUser;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const accountRef = useRef<HTMLDivElement>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [displayName, setDisplayName] = useState(() => fallbackDisplayName(user));
  const [avatarPath, setAvatarPath] = useState(user.avatarPath);
  const [avatarUrl, setAvatarUrl] = useState("");

  const links = useMemo(
    () =>
      isAdmin
        ? [
            ...standardLinks,
            ["/dashboard/admin", ShieldCheck, "Admin"] as const,
          ]
        : standardLinks,
    [isAdmin],
  );

  const avatarText = (displayName || user.email || "F")
    .trim()
    .slice(0, 1)
    .toUpperCase();
  const settingsActive = pathname.startsWith("/dashboard/settings");

  useEffect(() => {
    setPendingHref(null);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!pendingHref) return;
    const timer = window.setTimeout(() => setPendingHref(null), 8000);
    return () => window.clearTimeout(timer);
  }, [pendingHref]);

  useEffect(() => {
    let active = true;

    async function loadAvatar() {
      if (!avatarPath) {
        if (active) setAvatarUrl("");
        return;
      }

      const { data, error } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(avatarPath, 60 * 60);

      if (!active) return;
      setAvatarUrl(error ? "" : data.signedUrl);
    }

    void loadAvatar();

    return () => {
      active = false;
    };
  }, [avatarPath, supabase]);

  useEffect(() => {
    function handleProfileUpdate(event: Event) {
      const detail = (event as CustomEvent<ProfileUpdatedDetail>).detail;
      if (
        typeof detail?.displayName === "string" ||
        typeof detail?.fullName === "string"
      ) {
        setDisplayName(
          detail.displayName?.trim() ||
            detail.fullName?.trim() ||
            fallbackDisplayName({ ...user, displayName: "" }),
        );
      }
      if (typeof detail?.profilePhotoPath === "string") {
        setAvatarPath(detail.profilePhotoPath);
      }
    }

    window.addEventListener("ficonter:profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("ficonter:profile-updated", handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

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
    setPendingHref(pathname === targetPath ? null : targetPath);
    router.push(href);
  }

  async function signOut(event: ReactMouseEvent<HTMLButtonElement>) {
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
    <aside className={`sidebar ${styles.sidebarRoot}`}>
      <Brand href="/dashboard" />

      <nav
        className={`side-nav ${styles.navigation}`}
        aria-label="Private finance navigation"
      >
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
      </nav>

      <div className={styles.accountDock} ref={accountRef}>
        {menuOpen ? (
          <div className={styles.accountMenu} role="menu" aria-label="Account menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => openRoute("/dashboard/settings?section=profile")}
            >
              <UserRound size={17} aria-hidden="true" />
              <span>Profile</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => openRoute("/dashboard/settings?section=appearance")}
            >
              <Settings size={17} aria-hidden="true" />
              <span>Settings</span>
            </button>
            <div className={styles.accountMenuDivider} />
            <button
              type="button"
              role="menuitem"
              className={styles.signOutItem}
              disabled={signingOut}
              onClick={signOut}
            >
              <LogOut size={17} aria-hidden="true" />
              <span>{signingOut ? "Logging out…" : "Log out"}</span>
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className={`${styles.accountButton}${
            settingsActive ? ` ${styles.accountButtonActive}` : ""
          }`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={styles.avatar} aria-hidden="true">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : avatarText}
          </span>
          <span className={styles.accountIdentity}>
            <strong>{displayName}</strong>
            <small>{user.email}</small>
          </span>
          <ChevronUp
            className={`${styles.accountChevron}${
              menuOpen ? ` ${styles.accountChevronOpen}` : ""
            }`}
            size={17}
            aria-hidden="true"
          />
        </button>
      </div>

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
