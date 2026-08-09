"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeftRight,
  ChartPie,
  ChevronDown,
  ChevronUp,
  Compass,
  CircleHelp,
  CreditCard,
  FileArchive,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  PiggyBank,
  ReceiptText,
  Route,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
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
import { NotificationCenter } from "./NotificationCenter";
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
  email?: string;
};

type NavigationLink = readonly [
  href: string,
  icon: LucideIcon,
  label: string,
];

type NavigationGroupKey =
  | "money-management"
  | "wealth-engine"
  | "financial-progress"
  | "resources"
  | "administration";

type NavigationGroup = {
  key: NavigationGroupKey;
  label: string;
  links: readonly NavigationLink[];
};

const primaryLinks = [
  ["/dashboard", LayoutDashboard, "Overview"],
] as const satisfies readonly NavigationLink[];

const standardGroups = [
  {
    key: "money-management",
    label: "Money",
    links: [
      ["/dashboard/transactions", ArrowLeftRight, "Transactions"],
      ["/dashboard/bills", ReceiptText, "Bills"],
      ["/dashboard/credit-cards", CreditCard, "Credit Cards"],
      ["/dashboard/debt", Landmark, "Debts"],
      ["/dashboard/cash-flow", Activity, "Cash flow"],
    ],
  },
  {
    key: "financial-progress",
    label: "Planning",
    links: [
      ["/dashboard/budget", ChartPie, "Monthly planner"],
      ["/dashboard/savings", PiggyBank, "Savings Intelligence"],
      ["/dashboard/goals", Target, "Goals"],
      ["/dashboard/emergency-fund", ShieldCheck, "Emergency Fund"],
    ],
  },
  {
    key: "wealth-engine",
    label: "Wealth",
    links: [
      ["/dashboard/net-worth", TrendingUp, "Net Worth"],
      ["/dashboard/gps", Compass, "Financial GPS"],
      [
        "/dashboard/financial-independence",
        Route,
        "Financial Independence",
      ],
      ["/dashboard/insights", Sparkles, "Smart Insights"],
    ],
  },
  {
    key: "resources",
    label: "Tools",
    links: [["/dashboard/documents", FileArchive, "Documents"]],
  },
] as const satisfies readonly NavigationGroup[];

function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/dashboard" || href === "/dashboard/admin") {
    return pathname === href;
  }

  return pathname.startsWith(href);
}

function fallbackDisplayName(user: SidebarUser): string {
  const provided = user.displayName.trim();
  if (provided) return provided;

  const emailName = user.email.split("@")[0]?.trim();
  return emailName || "Ficonter member";
}

export function Sidebar({
  isAdmin = false,
  subscriptionPlanCode,
  user,
}: {
  isAdmin?: boolean;
  subscriptionPlanCode: SubscriptionPlanCode;
  user: SidebarUser;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const accountRef = useRef<HTMLDivElement>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<
    Record<NavigationGroupKey, boolean>
  >(() => ({
    "money-management": true,
    "wealth-engine": true,
    "financial-progress": true,
    resources: true,
    administration: true,
  }));
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [displayName, setDisplayName] = useState(() => fallbackDisplayName(user));
  const [accountEmail, setAccountEmail] = useState(user.email);
  const [avatarPath, setAvatarPath] = useState(user.avatarPath);
  const [avatarUrl, setAvatarUrl] = useState("");

  const navigationGroups = useMemo<readonly NavigationGroup[]>(() => {
    if (!isAdmin) return standardGroups;

    const administrationGroup: NavigationGroup = {
      key: "administration",
      label: "Administration",
      links: [
        ["/dashboard/admin", ShieldCheck, "Admin"],
        [
          "/dashboard/admin/support",
          MessageSquareText,
          "Support inbox",
        ],
      ],
    };

    return [...standardGroups, administrationGroup];
  }, [isAdmin]);

  const avatarText = (displayName || accountEmail || "F")
    .trim()
    .slice(0, 1)
    .toUpperCase();
  const accountAreaActive =
    pathname.startsWith("/dashboard/setup") ||
    pathname.startsWith("/dashboard/settings") ||
    pathname.startsWith("/dashboard/help") ||
    pathname.startsWith("/dashboard/inbox") ||
    pathname.startsWith("/dashboard/documents");

  useEffect(() => {
    setPendingHref(null);
    setMenuOpen(false);

    setOpenGroups((current) => {
      let next = current;

      for (const group of navigationGroups) {
        const containsActiveRoute = group.links.some(([href]) =>
          isRouteActive(pathname, href),
        );

        if (containsActiveRoute && !next[group.key]) {
          if (next === current) next = { ...current };
          next[group.key] = true;
        }
      }

      return next;
    });
  }, [navigationGroups, pathname]);

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
            fallbackDisplayName({ ...user, email: accountEmail, displayName: "" }),
        );
      }
      if (typeof detail?.profilePhotoPath === "string") {
        setAvatarPath(detail.profilePhotoPath);
      }
      if (typeof detail?.email === "string" && detail.email.trim()) {
        setAccountEmail(detail.email.trim());
      }
    }

    window.addEventListener("ficonter:profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("ficonter:profile-updated", handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextEmail = session?.user.email?.trim();
      if (nextEmail) setAccountEmail(nextEmail);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    function openContactUs() {
      setMenuOpen(false);
      setContactOpen(true);
    }

    window.addEventListener(OPEN_CONTACT_EVENT, openContactUs);
    return () => window.removeEventListener(OPEN_CONTACT_EVENT, openContactUs);
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
      <div className={styles.sidebarHeader}>
        <span className={styles.headerGlow} aria-hidden="true" />
        <Brand href="/dashboard" />
        <div className={styles.headerIdentity}>
          <span className={styles.headerAvatar} aria-hidden="true">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : avatarText}
          </span>
          <span className={styles.headerIdentityText}>
            <strong>{displayName}</strong>
            <small>Personal workspace</small>
          </span>
          <span className={styles.workspacePill}>Personal</span>
        </div>
      </div>

      <nav
        className={`side-nav ${styles.navigation}`}
        aria-label="Private finance navigation"
      >
        <div className={styles.navigationSection}>
          <span className={styles.sectionLabel}>Main</span>
          <div className={styles.primaryLinks}>
            {primaryLinks.map(([href, Icon, label]) => {
              const active = isRouteActive(pathname, href);
              const pending = pendingHref === href;

              return (
                <Link
                  className={`side-link ${styles.link}${
                    active ? " active" : ""
                  }${pending ? ` ${styles.pending}` : ""}`}
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
          </div>
        </div>

        {navigationGroups.map((group) => {
          const open = openGroups[group.key];
          const groupActive = group.links.some(([href]) =>
            isRouteActive(pathname, href),
          );
          const panelId = `sidebar-group-${group.key}`;

          return (
            <section className={styles.navigationGroup} key={group.key}>
              <button
                type="button"
                className={`${styles.groupButton}${
                  groupActive ? ` ${styles.groupButtonActive}` : ""
                }`}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() =>
                  setOpenGroups((current) => ({
                    ...current,
                    [group.key]: !current[group.key],
                  }))
                }
              >
                <span>{group.label}</span>
                <ChevronDown
                  className={`${styles.groupChevron}${
                    open ? ` ${styles.groupChevronOpen}` : ""
                  }`}
                  size={15}
                  aria-hidden="true"
                />
              </button>

              {open ? (
                <div
                  className={styles.groupLinks}
                  id={panelId}
                  data-testid={`sidebar-${group.key}`}
                >
                  {group.links.map(([href, Icon, label]) => {
                    const feature = subscriptionFeatureForPersonalRoute(href);
                    const locked = Boolean(
                      feature &&
                        !hasSubscriptionFeature(subscriptionPlanCode, feature),
                    );
                    const targetHref =
                      locked && feature
                        ? getSubscriptionUpgradeHref(feature)
                        : href;
                    const active = !locked && isRouteActive(pathname, href);
                    const pending = pendingHref === targetHref;

                    return (
                      <Link
                        className={`side-link ${styles.link}${
                          active ? " active" : ""
                        }${pending ? ` ${styles.pending}` : ""}`}
                        href={targetHref}
                        key={href}
                        prefetch={false}
                        aria-current={active ? "page" : undefined}
                        aria-label={locked ? `${label} — upgrade required` : undefined}
                        title={locked ? "Upgrade required" : undefined}
                        onClick={() => {
                          if (!active) setPendingHref(targetHref);
                        }}
                      >
                        <Icon size={18} aria-hidden="true" />
                        <span>{label}</span>
                        {locked ? (
                          <LockKeyhole size={13} aria-hidden="true" />
                        ) : null}
                        {pending ? (
                          <span
                            className={styles.spinner}
                            aria-label="Opening page"
                          />
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>

      <div className={styles.accountDock} ref={accountRef}>
        <NotificationCenter isAdmin={isAdmin} />
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
              onClick={() => openRoute("/dashboard/setup")}
            >
              <ListChecks size={17} aria-hidden="true" />
              <span>Financial setup</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => openRoute("/dashboard/settings?section=appearance")}
            >
              <Settings size={17} aria-hidden="true" />
              <span>Settings</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => openRoute("/dashboard/help")}
            >
              <CircleHelp size={17} aria-hidden="true" />
              <span>Help</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setContactOpen(true);
              }}
            >
              <MessageSquareText size={17} aria-hidden="true" />
              <span>Contact Us</span>
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
            accountAreaActive ? ` ${styles.accountButtonActive}` : ""
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
            <small>{accountEmail}</small>
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

      <ContactSupportModal
        open={contactOpen}
        defaultEmail={accountEmail}
        onClose={() => setContactOpen(false)}
      />
    </aside>
  );
}
