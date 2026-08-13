"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
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
  Menu,
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
  UserRound,
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
    href: "/dashboard/overview",
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

    return pathname === "/dashboard" || pathname === "/dashboard/overview";
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

function isRootWorkspaceRoute(pathname: string, workspace: Workspace) {
  if (workspace === "business") {
    return pathname === "/business" || pathname === "/business/overview";
  }

  return pathname === "/dashboard" || pathname === "/dashboard/overview";
}

type NavigationDirection = "forward" | "back";

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
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [switchingBusiness, setSwitchingBusiness] = useState(false);
  const [businessSwitchError, setBusinessSwitchError] = useState("");
  const [selectedBusinessId, setSelectedBusinessId] = useState(
    activeBusinessId ?? "",
  );
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const drawerCloseButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const previousPathnameRef = useRef(pathname);
  const transitionTimerRef = useRef<number | null>(null);
  const edgeSwipeStartRef = useRef<{ x: number; y: number } | null>(null);

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

  const rootRoute = workspace === "business" ? "/business/overview" : "/dashboard/overview";
  const rootScreen = isRootWorkspaceRoute(pathname, workspace);

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

  function beginNavigationTransition(direction: NavigationDirection) {
    const root = document.documentElement;
    root.dataset.ficonterNavDirection = direction;
    root.dataset.ficonterNavTransition = "pending";
  }

  function navigateBack() {
    if (rootScreen) return;

    beginNavigationTransition("back");
    const startingPath = window.location.pathname;
    window.history.back();

    window.setTimeout(() => {
      if (window.location.pathname === startingPath) {
        beginNavigationTransition("back");
        router.push(rootRoute);
      }
    }, 260);
  }

  function navigateForward(href: string) {
    if (href === pathname) return;
    beginNavigationTransition("forward");
  }

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
    const root = document.documentElement;
    const previousPathname = previousPathnameRef.current;

    if (previousPathname !== pathname) {
      if (!root.dataset.ficonterNavDirection) {
        root.dataset.ficonterNavDirection = "forward";
      }

      root.dataset.ficonterNavTransition = "active";

      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }

      transitionTimerRef.current = window.setTimeout(() => {
        delete root.dataset.ficonterNavTransition;
        delete root.dataset.ficonterNavDirection;
        transitionTimerRef.current = null;
      }, 360);

      previousPathnameRef.current = pathname;
    }

    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
  }, [pathname]);

  useEffect(() => {
    const onPopState = () => beginNavigationTransition("back");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (rootScreen) return;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX > 26) return;
      edgeSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const onTouchEnd = (event: TouchEvent) => {
      const start = edgeSwipeStartRef.current;
      edgeSwipeStartRef.current = null;
      if (!start || event.changedTouches.length !== 1) return;

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - start.x;
      const deltaY = Math.abs(touch.clientY - start.y);

      if (deltaX >= 76 && deltaY <= 58) {
        navigateBack();
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [rootScreen, pathname]);

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
    setAccountMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setSelectedBusinessId(activeBusinessId ?? "");
    setBusinessSwitchError("");
  }, [activeBusinessId]);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (accountButtonRef.current?.contains(target)) return;
      if (accountMenuRef.current?.contains(target)) return;
      setAccountMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAccountMenuOpen(false);
      window.requestAnimationFrame(() => {
        accountButtonRef.current?.focus({ preventScroll: true });
      });
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [accountMenuOpen]);

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
    setAccountMenuOpen(false);
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
    setAccountMenuOpen(false);

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
        {rootScreen ? (
          <button
            ref={menuButtonRef}
            type="button"
            className={`${styles.menuButton} ${styles.brandMenuButton}`}
            onClick={openDrawer}
            aria-label="Open app navigation"
            aria-expanded={drawerOpen}
            aria-controls="ficonter-app-drawer"
          >
            <img
              className={styles.headerBrandMark}
              src="/ficonter-mark.svg"
              alt=""
              width={38}
              height={38}
              aria-hidden="true"
            />
            <span className={styles.menuBadge} aria-hidden="true">
              <Menu size={12} strokeWidth={2.4} />
            </span>
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.menuButton} ${styles.backButton}`}
            onClick={navigateBack}
            aria-label={`Back from ${route.title}`}
          >
            <ArrowLeft size={24} strokeWidth={2.25} aria-hidden={true} />
          </button>
        )}

        <div className={styles.routeIdentity}>
          <span className={styles.routeEyebrow}>
            {workspace === "business" ? "BUSINESS" : "PERSONAL"} · FICONTER
          </span>
          <strong>{route.title}</strong>
        </div>

        <button
          ref={accountButtonRef}
          type="button"
          className={styles.workspaceBadge}
          title={`${accountName} — account menu`}
          aria-label={`Open account menu for ${accountName}`}
          aria-haspopup="menu"
          aria-expanded={accountMenuOpen}
          aria-controls="ficonter-account-menu"
          onClick={() => {
            setDrawerOpen(false);
            setAccountMenuOpen((open) => !open);
          }}
        >
          <span>{accountInitial}</span>
        </button>

        <div
          ref={accountMenuRef}
          id="ficonter-account-menu"
          className={`${styles.accountMenu} ${
            accountMenuOpen ? styles.accountMenuOpen : ""
          }`}
          role="menu"
          aria-label="Account actions"
          aria-hidden={!accountMenuOpen}
        >
          <Link
            href="/dashboard/settings?section=profile"
            prefetch={true}
            className={styles.accountMenuItem}
            role="menuitem"
            tabIndex={accountMenuOpen ? 0 : -1}
            onClick={() => {
              setAccountMenuOpen(false);
              navigateForward("/dashboard/settings?section=profile");
            }}
          >
            <UserRound size={19} aria-hidden={true} />
            <span>Profile</span>
          </Link>
          <button
            type="button"
            className={`${styles.accountMenuItem} ${styles.accountMenuDanger}`}
            role="menuitem"
            tabIndex={accountMenuOpen ? 0 : -1}
            onClick={() => void signOut()}
            disabled={signingOut}
          >
            <LogOut size={19} aria-hidden={true} />
            <span>{signingOut ? "Logging out…" : "Log out"}</span>
          </button>
        </div>

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
              onClick={() => navigateForward(item.href)}
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
              beginNavigationTransition("forward");
              router.push(addHref);
              return;
            }

            if (isTransactionRoute) {
              window.dispatchEvent(
                new CustomEvent("ficonter:quick-add-transaction"),
              );
              return;
            }

            beginNavigationTransition("forward");
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
              onClick={() => navigateForward(item.href)}
            >
              <Icon size={21} aria-hidden={true} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <Link
          href="/dashboard/settings"
          prefetch={true}
          className={`${styles.dockItem} ${
            pathname.startsWith("/dashboard/settings") ? styles.dockActive : ""
          }`}
          aria-current={
            pathname.startsWith("/dashboard/settings") ? "page" : undefined
          }
          onClick={() => navigateForward("/dashboard/settings")}
        >
          <Settings2 size={21} aria-hidden={true} />
          <span>Settings</span>
        </Link>
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
          <img
            className={styles.appMark}
            src="/ficonter-mark.svg"
            alt=""
            width={46}
            height={46}
            aria-hidden="true"
          />
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
          onClick={() => {
            navigateForward(switchTargetHref);
            setDrawerOpen(false);
          }}
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
                      onClick={() => {
                        navigateForward(targetHref);
                        setDrawerOpen(false);
                      }}
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
