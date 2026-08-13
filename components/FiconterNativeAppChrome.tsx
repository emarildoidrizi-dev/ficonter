"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarRange,
  ChartNoAxesCombined,
  ChevronRight,
  CirclePlus,
  CreditCard,
  FileText,
  Goal,
  HandCoins,
  House,
  Landmark,
  LayoutGrid,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  PackageOpen,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { switchActiveBusinessAction } from "@/app/business/actions";
import { getSubscriptionUpgradeHref, subscriptionFeatureForPersonalRoute } from "@/lib/subscriptionNavigation";
import { hasSubscriptionFeature, type SubscriptionPlanCode } from "@/lib/subscriptionPlans";
import styles from "./FiconterNativeAppChrome.module.css";

type Workspace = "personal" | "business";

type IconType = ComponentType<{
  size?: number | string;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
}>;

type RouteItem = {
  href: string;
  label: string;
  title: string;
  icon: IconType;
  exact?: boolean;
};

type RouteGroup = {
  label: string;
  routes: RouteItem[];
};

type BusinessProfileOption = {
  id: string;
  name: string;
};

type Props = {
  workspace: Workspace;
  displayName: string;
  email?: string;
  businessName?: string;
  businessProfiles?: BusinessProfileOption[];
  activeBusinessId?: string | null;
  subscriptionPlanCode: SubscriptionPlanCode;
};

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

type DeviceClass = "phone" | "tablet" | "desktop";

const personalRoutes: RouteItem[] = [
  {
    href: "/dashboard",
    label: "Home",
    title: "Overview",
    icon: House,
    exact: true,
  },
  {
    href: "/dashboard/transactions",
    label: "Activity",
    title: "Transactions",
    icon: ReceiptText,
  },
  {
    href: "/dashboard/budget",
    label: "Plan",
    title: "Monthly plan",
    icon: CalendarRange,
  },
  {
    href: "/dashboard/bills",
    label: "Bills",
    title: "Bills",
    icon: FileText,
  },
  {
    href: "/dashboard/savings",
    label: "Savings",
    title: "Savings",
    icon: HandCoins,
  },
  {
    href: "/dashboard/debt",
    label: "Debt",
    title: "Debt",
    icon: Landmark,
  },
  {
    href: "/dashboard/credit-cards",
    label: "Credit cards",
    title: "Credit Cards",
    icon: CreditCard,
  },
  {
    href: "/dashboard/goals",
    label: "Goals",
    title: "Goals",
    icon: Goal,
  },
  {
    href: "/dashboard/net-worth",
    label: "Net worth",
    title: "Net worth",
    icon: TrendingUp,
  },
  {
    href: "/dashboard/cash-flow",
    label: "Cash flow",
    title: "Cash flow",
    icon: ChartNoAxesCombined,
  },
  {
    href: "/dashboard/emergency-fund",
    label: "Emergency fund",
    title: "Emergency fund",
    icon: ShieldCheck,
  },
  {
    href: "/dashboard/gps",
    label: "Financial GPS",
    title: "Financial GPS",
    icon: Target,
  },
  {
    href: "/dashboard/financial-independence",
    label: "Independence",
    title: "Financial independence",
    icon: Sparkles,
  },
  {
    href: "/dashboard/insights",
    label: "Insights",
    title: "Insights",
    icon: BarChart3,
  },
  {
    href: "/dashboard/documents",
    label: "Documents",
    title: "Documents",
    icon: BookOpen,
  },
  {
    href: "/dashboard/inbox",
    label: "Messages",
    title: "Messages",
    icon: MessageSquareText,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    title: "Settings",
    icon: Settings2,
  },
];

const businessRoutes: RouteItem[] = [
  {
    href: "/business/overview",
    label: "Home",
    title: "Business overview",
    icon: House,
    exact: true,
  },
  {
    href: "/business/sales",
    label: "Sales",
    title: "Sales",
    icon: ShoppingBag,
  },
  {
    href: "/business/transactions",
    label: "Activity",
    title: "Business activity",
    icon: ReceiptText,
  },
  {
    href: "/business/inventory",
    label: "Inventory",
    title: "Inventory",
    icon: PackageOpen,
  },
  {
    href: "/business/cost-control",
    label: "Costs",
    title: "Cost control",
    icon: ChartNoAxesCombined,
  },
  {
    href: "/business/suppliers",
    label: "Suppliers",
    title: "Suppliers",
    icon: Building2,
  },
  {
    href: "/business/reports",
    label: "Reports",
    title: "Reports",
    icon: BarChart3,
  },
  {
    href: "/business/administration",
    label: "Administration",
    title: "Administration",
    icon: ShieldCheck,
  },
  {
    href: "/business/manage",
    label: "Businesses",
    title: "Manage businesses",
    icon: BriefcaseBusiness,
  },
];

const personalRouteGroups: RouteGroup[] = [
  {
    label: "Overview",
    routes: [personalRoutes[0]],
  },
  {
    label: "Money",
    routes: [
      personalRoutes[1],
      personalRoutes[3],
      personalRoutes[6],
      personalRoutes[5],
      personalRoutes[9],
    ],
  },
  {
    label: "Planning",
    routes: [
      personalRoutes[2],
      personalRoutes[4],
      personalRoutes[7],
      personalRoutes[10],
    ],
  },
  {
    label: "Wealth",
    routes: [
      personalRoutes[8],
      personalRoutes[11],
      personalRoutes[12],
      personalRoutes[13],
    ],
  },
  {
    label: "Tools & account",
    routes: [
      personalRoutes[14],
      personalRoutes[15],
      personalRoutes[16],
    ],
  },
];

const businessRouteGroups: RouteGroup[] = [
  {
    label: "Overview",
    routes: [businessRoutes[0]],
  },
  {
    label: "Operations",
    routes: [
      businessRoutes[1],
      businessRoutes[2],
      businessRoutes[3],
      businessRoutes[4],
    ],
  },
  {
    label: "Management",
    routes: [
      businessRoutes[5],
      businessRoutes[6],
      businessRoutes[7],
      businessRoutes[8],
    ],
  },
];

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as IOSNavigator).standalone)
  );
}

function readViewportSize() {
  const viewport = window.visualViewport;
  const width = Math.max(
    1,
    Math.round(
      viewport?.width ||
        window.innerWidth ||
        document.documentElement.clientWidth,
    ),
  );
  const height = Math.max(
    1,
    Math.round(
      viewport?.height ||
        window.innerHeight ||
        document.documentElement.clientHeight,
    ),
  );

  return { width, height };
}

function resolveDeviceClass(): DeviceClass {
  const { width, height } = readViewportSize();
  const shortestPhysicalSide = Math.min(
    window.screen.width || width,
    window.screen.height || height,
  );
  const touchCapable =
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches;
  const compactViewport = width <= 900;
  const tabletOrFoldable =
    touchCapable &&
    shortestPhysicalSide <= 1180 &&
    Math.max(width, height) <= 1440;
  const installedCompact = isStandalone() && width <= 1180;

  if (
    !compactViewport &&
    !tabletOrFoldable &&
    !installedCompact
  ) {
    return "desktop";
  }

  if (
    width <= 640 ||
    (touchCapable && shortestPhysicalSide <= 640)
  ) {
    return "phone";
  }

  return "tablet";
}

function synchronizeNativeAppMode() {
  const root = document.documentElement;
  const { width, height } = readViewportSize();
  const device = resolveDeviceClass();
  const layoutHeight = Math.max(
    1,
    Math.round(window.innerHeight || document.documentElement.clientHeight),
  );
  const visualHeight = Math.max(
    1,
    Math.round(window.visualViewport?.height || layoutHeight),
  );
  const keyboardThreshold = Math.max(160, Math.round(layoutHeight * 0.18));
  const keyboardOpen =
    device !== "desktop" &&
    layoutHeight - visualHeight >= keyboardThreshold;

  root.dataset.ficonterNativeApp =
    device === "desktop" ? "false" : "true";
  root.dataset.ficonterDevice = device;
  root.dataset.ficonterDisplayMode = isStandalone()
    ? "standalone"
    : "browser";
  root.dataset.ficonterOrientation =
    width >= height ? "landscape" : "portrait";
  root.dataset.ficonterKeyboard = keyboardOpen ? "open" : "closed";
  root.style.setProperty(
    "--ficonter-visual-viewport-height",
    `${visualHeight}px`,
  );
}

function activeRoute(
  pathname: string,
  route: RouteItem,
  workspace: Workspace,
) {
  if (route.exact) {
    if (workspace === "business") {
      return (
        pathname === "/business" ||
        pathname === "/business/overview"
      );
    }

    return pathname === "/dashboard";
  }

  return (
    pathname === route.href ||
    pathname.startsWith(`${route.href}/`)
  );
}

function currentRoute(
  pathname: string,
  routes: RouteItem[],
  workspace: Workspace,
) {
  return (
    [...routes]
      .sort((a, b) => b.href.length - a.href.length)
      .find((route) =>
        activeRoute(pathname, route, workspace),
      ) ?? routes[0]
  );
}

export function FiconterNativeAppChrome({
  workspace,
  displayName,
  email = "",
  businessName = "",
  businessProfiles = [],
  activeBusinessId = null,
  subscriptionPlanCode,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [switchingBusiness, setSwitchingBusiness] = useState(false);
  const [businessSwitchError, setBusinessSwitchError] = useState("");
  const [selectedBusinessId, setSelectedBusinessId] = useState(
    activeBusinessId ?? "",
  );
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const routes =
    workspace === "business"
      ? businessRoutes
      : personalRoutes;

  const routeGroups =
    workspace === "business"
      ? businessRouteGroups
      : personalRouteGroups;

  const route = useMemo(
    () => currentRoute(pathname, routes, workspace),
    [pathname, routes, workspace],
  );

  const identity =
    workspace === "business"
      ? businessName.trim() || "Business workspace"
      : displayName.trim() || "Personal workspace";

  const accountName = displayName.trim() || email.split("@")[0] || "Account";
  const accountInitial = accountName.slice(0, 1).toUpperCase() || "F";

  const primaryItems =
    workspace === "business"
      ? [businessRoutes[0], businessRoutes[1], businessRoutes[2]]
      : [personalRoutes[0], personalRoutes[1], personalRoutes[2]];

  const moreActive = !primaryItems.some((item) =>
    activeRoute(pathname, item, workspace),
  );

  const addHref =
    workspace === "business"
      ? "/business/transactions"
      : "/dashboard/transactions";

  const isTransactionRoute =
    workspace === "business"
      ? pathname === "/business/transactions"
      : pathname === "/dashboard/transactions";

  const switchHref =
    workspace === "business"
      ? "/dashboard"
      : "/business/overview";

  const businessWorkspaceLocked =
    workspace === "personal" &&
    !hasSubscriptionFeature(
      subscriptionPlanCode,
      "business_workspace",
    );

  const switchTargetHref = businessWorkspaceLocked
    ? getSubscriptionUpgradeHref("business_workspace")
    : switchHref;

  useEffect(() => {
    synchronizeNativeAppMode();

    const displayMode = window.matchMedia(
      "(display-mode: standalone)",
    );
    const compactViewport = window.matchMedia(
      "(max-width: 900px)",
    );

    const synchronize = () => synchronizeNativeAppMode();

    window.addEventListener("resize", synchronize);
    window.addEventListener(
      "orientationchange",
      synchronize,
    );
    window.visualViewport?.addEventListener(
      "resize",
      synchronize,
    );
    displayMode.addEventListener?.("change", synchronize);
    compactViewport.addEventListener?.(
      "change",
      synchronize,
    );

    return () => {
      window.removeEventListener("resize", synchronize);
      window.removeEventListener(
        "orientationchange",
        synchronize,
      );
      window.visualViewport?.removeEventListener(
        "resize",
        synchronize,
      );
      displayMode.removeEventListener?.(
        "change",
        synchronize,
      );
      compactViewport.removeEventListener?.(
        "change",
        synchronize,
      );
    };
  }, []);

  useEffect(() => {
    const scheduled = primaryItems.map((item, index) =>
      window.setTimeout(() => {
        router.prefetch(item.href);
      }, 80 + index * 80),
    );

    scheduled.push(
      window.setTimeout(() => {
        router.prefetch(addHref);
      }, 140),
    );

    return () => {
      scheduled.forEach((timer) =>
        window.clearTimeout(timer),
      );
    };
  }, [addHref, router, workspace]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    setSelectedBusinessId(activeBusinessId ?? "");
    setBusinessSwitchError("");
  }, [activeBusinessId]);

  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        window.requestAnimationFrame(() => {
          menuButtonRef.current?.focus({ preventScroll: true });
        });
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("inert"));

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    document.documentElement.dataset.ficonterAppDrawer =
      drawerOpen ? "open" : "closed";

    if (drawerOpen) {
      window.requestAnimationFrame(() => {
        drawerCloseButtonRef.current?.focus({ preventScroll: true });
      });
    }

    return () => {
      document.documentElement.dataset.ficonterAppDrawer =
        "closed";
    };
  }, [drawerOpen]);

  function openDrawer() {
    setDrawerOpen(true);

    routes.forEach((item, index) => {
      window.setTimeout(() => {
        router.prefetch(item.href);
      }, index * 45);
    });
  }

  async function switchBusinessProfile(nextBusinessId: string) {
    if (
      workspace !== "business" ||
      !nextBusinessId ||
      nextBusinessId === activeBusinessId ||
      switchingBusiness
    ) {
      return;
    }

    const previousBusinessId = selectedBusinessId || activeBusinessId || "";
    setSelectedBusinessId(nextBusinessId);
    setSwitchingBusiness(true);
    setBusinessSwitchError("");

    const result = await switchActiveBusinessAction(nextBusinessId);

    if (!result.ok) {
      setSelectedBusinessId(previousBusinessId);
      setBusinessSwitchError(result.error);
      setSwitchingBusiness(false);
      return;
    }

    setSwitchingBusiness(false);
    router.refresh();
  }

  async function signOut() {
    if (signingOut) return;

    setSigningOut(true);
    setDrawerOpen(false);

    const root = document.documentElement;

    root.dataset.ficonterAppDrawer = "closed";
    root.removeAttribute("data-ficonter-route-loading");
    root.removeAttribute("data-mobile-nav-open");

    document.documentElement.style.removeProperty("overflow");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("pointer-events");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setSigningOut(false);
      synchronizeNativeAppMode();
      return;
    }

    root.removeAttribute("data-ficonter-native-app");

    window.location.replace("/login");
  }

  return (
    <>
      <header
        className={`${styles.header} ${
          workspace === "business" ? styles.businessHeader : ""
        }`}
      >
        <button
          ref={menuButtonRef}
          type="button"
          className={styles.menuButton}
          onClick={openDrawer}
          aria-label="Open app navigation"
          aria-expanded={drawerOpen}
          aria-controls="ficonter-app-drawer"
        >
          <span className={styles.headerMark} aria-hidden="true">F</span>
        </button>

        <div className={styles.routeIdentity}>
          <span className={styles.routeEyebrow}>
            {workspace === "business" ? "BUSINESS" : "PERSONAL"} · FICONTER
          </span>
          <strong>{route.title}</strong>
        </div>

        <button
          type="button"
          className={styles.workspaceBadge}
          title={`${accountName} — account`}
          aria-label={`Open account menu for ${accountName}`}
          aria-expanded={drawerOpen}
          onClick={openDrawer}
        >
          <span>{accountInitial}</span>
        </button>

        {workspace === "business" && businessProfiles.length ? (
          <label className={styles.businessProfileBar}>
            <span className={styles.businessProfileIcon} aria-hidden="true">
              <Building2 size={16} />
            </span>
            <span className={styles.businessProfileLabel}>Active business</span>
            <select
              value={selectedBusinessId || activeBusinessId || businessProfiles[0]?.id || ""}
              onChange={(event) => void switchBusinessProfile(event.target.value)}
              disabled={switchingBusiness}
              aria-label="Change active business profile"
            >
              {businessProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
            <ChevronRight className={styles.businessProfileChevron} size={16} aria-hidden="true" />
          </label>
        ) : null}
      </header>

      <nav
        className={styles.bottomDock}
        aria-label={`${workspace} app navigation`}
      >
        {primaryItems.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const active = activeRoute(
            pathname,
            item,
            workspace,
          );

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`${styles.dockItem} ${
                active ? styles.dockActive : ""
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={21} aria-hidden={true} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          className={styles.addButton}
          aria-label={
            workspace === "business"
              ? "Add business transaction"
              : "Quick add transaction"
          }
          onClick={() => {
            if (workspace === "business") {
              router.push(addHref);
              return;
            }

            if (isTransactionRoute) {
              window.dispatchEvent(
                new CustomEvent("ficonter:quick-add-transaction"),
              );
              return;
            }

            router.push(`${addHref}#quick-add`);
          }}
        >
          <CirclePlus size={27} aria-hidden={true} />
        </button>

        {primaryItems.slice(2, 3).map((item) => {
          const Icon = item.icon;
          const active = activeRoute(
            pathname,
            item,
            workspace,
          );

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`${styles.dockItem} ${
                active ? styles.dockActive : ""
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={21} aria-hidden={true} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          className={`${styles.dockItem} ${
            moreActive ? styles.dockActive : ""
          }`}
          onClick={openDrawer}
          aria-label="Open all sections"
          aria-expanded={drawerOpen}
        >
          <LayoutGrid size={21} aria-hidden={true} />
          <span>More</span>
        </button>
      </nav>

      <button
        type="button"
        className={`${styles.backdrop} ${
          drawerOpen ? styles.backdropOpen : ""
        }`}
        onClick={() => {
          setDrawerOpen(false);
          window.requestAnimationFrame(() => {
            menuButtonRef.current?.focus({ preventScroll: true });
          });
        }}
        aria-label="Close app navigation"
        tabIndex={drawerOpen ? 0 : -1}
      />

      <aside
        ref={drawerRef}
        id="ficonter-app-drawer"
        className={`${styles.drawer} ${
          drawerOpen ? styles.drawerOpen : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="FICONTER app navigation"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
      >
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.drawerHeader}>
          <div className={styles.appMark}>F</div>
          <div>
            <span>FICONTER</span>
            <strong>All sections</strong>
            <small>{identity}</small>
          </div>
          <button
            ref={drawerCloseButtonRef}
            type="button"
            onClick={() => {
              setDrawerOpen(false);
              window.requestAnimationFrame(() => {
                menuButtonRef.current?.focus({ preventScroll: true });
              });
            }}
            aria-label="Close app navigation"
          >
            <X size={22} aria-hidden={true} />
          </button>
        </div>

        <div className={styles.accountPanel}>
          <span className={styles.accountAvatar} aria-hidden="true">{accountInitial}</span>
          <span className={styles.accountIdentity}>
            <strong>{accountName}</strong>
            <small>{email || (workspace === "business" ? identity : "Signed in")}</small>
          </span>
          <button
            type="button"
            className={styles.accountSignOut}
            onClick={() => void signOut()}
            disabled={signingOut}
            aria-label="Sign out"
          >
            <LogOut size={18} aria-hidden={true} />
            <span>{signingOut ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>

        {workspace === "business" && businessProfiles.length ? (
          <label className={styles.drawerBusinessSelector}>
            <span>Business profile</span>
            <select
              value={selectedBusinessId || activeBusinessId || businessProfiles[0]?.id || ""}
              onChange={(event) => void switchBusinessProfile(event.target.value)}
              disabled={switchingBusiness}
              aria-label="Change active business profile"
            >
              {businessProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
            {switchingBusiness ? <small>Updating business…</small> : null}
            {businessSwitchError ? <small className={styles.businessProfileError}>{businessSwitchError}</small> : null}
          </label>
        ) : null}

        <Link
          href={switchTargetHref}
          prefetch={!businessWorkspaceLocked}
          className={styles.workspaceSwitch}
          aria-label={
            businessWorkspaceLocked
              ? "Open business workspace — Business Pro required"
              : undefined
          }
        >
          <span>
            {workspace === "business"
              ? "Open personal workspace"
              : businessWorkspaceLocked
                ? "Business workspace · Business Pro"
                : "Open business workspace"}
          </span>
          {businessWorkspaceLocked ? (
            <LockKeyhole size={17} aria-hidden={true} />
          ) : (
            <ChevronRight size={18} aria-hidden={true} />
          )}
        </Link>

        <nav className={styles.drawerNavigation} aria-label="All app sections">
          {routeGroups.map((group) => (
            <section className={styles.drawerGroup} key={group.label}>
              <div className={styles.drawerLabel}>{group.label}</div>
              <div className={styles.drawerGroupLinks}>
                {group.routes.map((item) => {
                  const Icon = item.icon;
                  const feature =
                    workspace === "personal"
                      ? subscriptionFeatureForPersonalRoute(item.href)
                      : null;
                  const locked = Boolean(
                    feature &&
                      !hasSubscriptionFeature(
                        subscriptionPlanCode,
                        feature,
                      ),
                  );
                  const targetHref =
                    locked && feature
                      ? getSubscriptionUpgradeHref(feature)
                      : item.href;
                  const active =
                    !locked &&
                    activeRoute(pathname, item, workspace);

                  return (
                    <Link
                      href={targetHref}
                      prefetch={!locked}
                      key={item.href}
                      className={`${styles.drawerLink} ${
                        active ? styles.drawerLinkActive : ""
                      }`}
                      aria-current={active ? "page" : undefined}
                      aria-label={
                        locked
                          ? `${item.label} — upgrade required`
                          : undefined
                      }
                    >
                      <span className={styles.drawerIcon}>
                        <Icon size={18} aria-hidden={true} />
                      </span>
                      <span className={styles.drawerLinkLabel}>{item.label}</span>
                      <span className={styles.drawerLinkStatus}>
                        {locked ? (
                          <LockKeyhole size={13} aria-hidden={true} />
                        ) : active ? (
                          <span className={styles.activeDot} aria-hidden="true" />
                        ) : null}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

      </aside>
    </>
  );
}
