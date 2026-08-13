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
  Menu,
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
  useState,
  type ComponentType,
} from "react";
import { createClient } from "@/lib/supabase/client";
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

type Props = {
  workspace: Workspace;
  displayName: string;
  businessName?: string;
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
  const { width } = readViewportSize();
  const screenWidth = window.screen.width || width;
  const screenHeight = window.screen.height || window.innerHeight || width;
  const shortestPhysicalSide = Math.min(screenWidth, screenHeight);
  const longestPhysicalSide = Math.max(screenWidth, screenHeight);
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const compactViewport = width <= 900;
  const compactTouchDevice =
    coarsePointer &&
    shortestPhysicalSide <= 820 &&
    longestPhysicalSide <= 1366;

  if (!compactViewport && !compactTouchDevice) {
    return "desktop";
  }

  if (width <= 640 || shortestPhysicalSide <= 480) {
    return "phone";
  }

  return "tablet";
}

function synchronizeNativeAppMode() {
  const root = document.documentElement;
  const { width, height } = readViewportSize();
  const device = resolveDeviceClass();

  root.dataset.ficonterNativeApp =
    device === "desktop" ? "false" : "true";
  root.dataset.ficonterDevice = device;
  root.dataset.ficonterDisplayMode = isStandalone()
    ? "standalone"
    : "browser";
  root.dataset.ficonterOrientation =
    width >= height ? "landscape" : "portrait";
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
  businessName = "",
  subscriptionPlanCode,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const routes =
    workspace === "business"
      ? businessRoutes
      : personalRoutes;

  const route = useMemo(
    () => currentRoute(pathname, routes, workspace),
    [pathname, routes, workspace],
  );

  const identity =
    workspace === "business"
      ? businessName.trim() || "Business workspace"
      : displayName.trim() || "Personal workspace";

  const primaryItems =
    workspace === "business"
      ? [
          businessRoutes[0],
          businessRoutes[1],
          businessRoutes[2],
          businessRoutes[6],
        ]
      : [
          personalRoutes[0],
          personalRoutes[1],
          personalRoutes[2],
          personalRoutes[16],
        ];

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
    document.documentElement.dataset.ficonterAppDrawer =
      drawerOpen ? "open" : "closed";

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
      <header className={styles.header}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={openDrawer}
          aria-label="Open app navigation"
          aria-expanded={drawerOpen}
        >
          <Menu size={22} aria-hidden={true} />
        </button>

        <div className={styles.routeIdentity}>
          <span>{route.title}</span>
          <strong title={identity}>{identity}</strong>
        </div>

        <span className={styles.workspaceBadge}>
          {workspace === "business"
            ? "Business"
            : "Personal"}
        </span>
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
          className={styles.dockItem}
          onClick={openDrawer}
          aria-label="Open all sections"
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
        onClick={() => setDrawerOpen(false)}
        aria-label="Close app navigation"
        tabIndex={drawerOpen ? 0 : -1}
      />

      <aside
        className={`${styles.drawer} ${
          drawerOpen ? styles.drawerOpen : ""
        }`}
        aria-hidden={!drawerOpen}
      >
        <div className={styles.drawerHeader}>
          <div className={styles.appMark}>F</div>
          <div>
            <span>FICONTER APP</span>
            <strong>{identity}</strong>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close app navigation"
          >
            <X size={22} aria-hidden={true} />
          </button>
        </div>

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

        <div className={styles.drawerLabel}>
          All sections
        </div>

        <nav className={styles.drawerNavigation}>
          {routes.map((item) => {
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
                  active
                    ? styles.drawerLinkActive
                    : ""
                }`}
                aria-current={
                  active ? "page" : undefined
                }
                aria-label={
                  locked
                    ? `${item.label} — upgrade required`
                    : undefined
                }
              >
                <span className={styles.drawerIcon}>
                  <Icon
                    size={19}
                    aria-hidden={true}
                  />
                </span>
                <span>{item.label}</span>
                {locked ? (
                  <LockKeyhole
                    size={15}
                    aria-hidden={true}
                  />
                ) : (
                  <ChevronRight
                    size={16}
                    aria-hidden={true}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className={styles.drawerFooter}>
          <button
            type="button"
            className={styles.signOutButton}
            onClick={() => void signOut()}
            disabled={signingOut}
          >
            <span className={styles.signOutIcon}>
              <LogOut
                size={19}
                aria-hidden={true}
              />
            </span>
            <span>
              {signingOut
                ? "Signing out…"
                : "Sign out"}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
