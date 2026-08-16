"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { getSubscriptionUpgradeHref, subscriptionFeatureForPersonalRoute } from "@/lib/subscriptionNavigation";
import { hasSubscriptionFeature, type SubscriptionPlanCode } from "@/lib/subscriptionPlans";
import { useInstantBusinessSwitch } from "./useInstantBusinessSwitch";
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
  avatarPath?: string;
  businessName?: string;
  businessProfiles?: BusinessProfileOption[];
  activeBusinessId?: string | null;
  subscriptionPlanCode: SubscriptionPlanCode;
  isAdmin?: boolean;
};

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

type DeviceClass = "phone" | "tablet" | "desktop";

const personalRoutes: RouteItem[] = [
  {
    href: "/dashboard/overview",
    label: "Overview",
    title: "Overview",
    icon: House,
    exact: true,
  },
  {
    href: "/dashboard/transactions",
    label: "Transactions",
    title: "Transactions",
    icon: ReceiptText,
  },
  {
    href: "/dashboard/budget",
    label: "Planner",
    title: "Monthly planner",
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
    href: "/dashboard/settings?section=profile",
    label: "Profile",
    title: "Profile",
    icon: UserRound,
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
    label: "Overview",
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
    label: "Transactions",
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

const adminRoutes: RouteItem[] = [
  {
    href: "/dashboard/admin",
    label: "Admin dashboard",
    title: "Administration",
    icon: ShieldCheck,
  },
  {
    href: "/dashboard/admin/usage",
    label: "Live & usage",
    title: "Admin live & usage",
    icon: BarChart3,
  },
  {
    href: "/dashboard/admin/support",
    label: "Support inbox",
    title: "Admin support",
    icon: MessageSquareText,
  },
  {
    href: "/business/admin",
    label: "Business admin",
    title: "Business administration",
    icon: Building2,
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
    label: "Tools",
    routes: [
      personalRoutes[14],
      personalRoutes[15],
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
    if (route.href === "/business/overview") {
      return pathname === "/business" || pathname === "/business/overview";
    }
    if (route.href === "/dashboard/overview") {
      return pathname === "/dashboard" || pathname === "/dashboard/overview";
    }
    return pathname === route.href;
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
  avatarPath = "",
  businessName = "",
  businessProfiles = [],
  activeBusinessId = null,
  subscriptionPlanCode,
  isAdmin = false,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const {
    businessId: displayedBusinessId,
    switchBusiness,
    switching: switchingBusiness,
    error: businessSwitchError,
  } = useInstantBusinessSwitch(activeBusinessId, workspace === "business");
  const [avatarUrl, setAvatarUrl] = useState("");
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseButtonRef = useRef<HTMLButtonElement>(null);
  const accountCloseButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const accountSheetRef = useRef<HTMLElement>(null);
  const navigationStackRef = useRef<string[]>([]);
  const lastHrefRef = useRef<string | null>(null);
  const navigatingBackRef = useRef(false);
  const [previousAppPath, setPreviousAppPath] = useState<string | null>(null);

  const routes = useMemo(
    () => [
      ...(workspace === "business" ? businessRoutes : personalRoutes),
      ...(isAdmin ? adminRoutes : []),
    ],
    [isAdmin, workspace],
  );

  const routeGroups = useMemo(
    () => [
      ...(workspace === "business" ? businessRouteGroups : personalRouteGroups),
      ...(isAdmin ? [{ label: "Platform admin", routes: adminRoutes }] : []),
    ],
    [isAdmin, workspace],
  );

  const route = useMemo(
    () => currentRoute(pathname, routes, workspace),
    [pathname, routes, workspace],
  );

  const isAdminRoute =
    pathname.startsWith("/dashboard/admin") || pathname.startsWith("/business/admin");

  const mobileRootPaths =
    workspace === "business"
      ? new Set(["/business", "/business/overview", "/business/sales", "/business/transactions"])
      : new Set(["/dashboard", "/dashboard/overview", "/dashboard/transactions", "/dashboard/budget"]);
  const showBackCommand = !mobileRootPaths.has(pathname);
  const fallbackBackHref =
    workspace === "business" ? "/business/overview" : "/dashboard/overview";

  const displayedBusinessName =
    businessProfiles.find((profile) => profile.id === displayedBusinessId)?.name ??
    businessName;

  const identity =
    workspace === "business"
      ? displayedBusinessName.trim() || "Business workspace"
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

  const transactionsHref =
    workspace === "business"
      ? "/business/transactions"
      : "/dashboard/transactions";

  const addHref = `${transactionsHref}?add=1`;
  const quickAddEventName =
    workspace === "business"
      ? "ficonter:business-quick-add-transaction"
      : "ficonter:quick-add-transaction";

  const currentSearch = searchParams.toString();
  const currentHref = currentSearch ? `${pathname}?${currentSearch}` : pathname;

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
    const previousHref = lastHrefRef.current;

    if (previousHref === null) {
      lastHrefRef.current = currentHref;
    } else if (previousHref !== currentHref) {
      if (navigatingBackRef.current) {
        navigatingBackRef.current = false;
      } else if (
        previousHref.startsWith(
          workspace === "business" ? "/business" : "/dashboard",
        ) &&
        previousHref !== currentHref
      ) {
        const stack = navigationStackRef.current;
        if (stack[stack.length - 1] !== previousHref) {
          stack.push(previousHref);
        }
      }

      lastHrefRef.current = currentHref;
    }

    const stack = navigationStackRef.current;
    setPreviousAppPath(stack[stack.length - 1] ?? null);
    setDrawerOpen(false);
    setAccountOpen(false);
  }, [currentHref]);

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

      if (active) setAvatarUrl(error ? "" : data.signedUrl);
    }

    void loadAvatar();
    return () => {
      active = false;
    };
  }, [avatarPath, supabase]);

  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        window.requestAnimationFrame(() => {
          moreButtonRef.current?.focus({ preventScroll: true });
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
    if (!accountOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        window.requestAnimationFrame(() => {
          accountButtonRef.current?.focus({ preventScroll: true });
        });
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        accountSheetRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

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
  }, [accountOpen]);

  useEffect(() => {
    document.documentElement.dataset.ficonterAccountMenu =
      accountOpen ? "open" : "closed";

    if (accountOpen) {
      window.requestAnimationFrame(() => {
        accountCloseButtonRef.current?.focus({ preventScroll: true });
      });
    }

    return () => {
      document.documentElement.dataset.ficonterAccountMenu = "closed";
    };
  }, [accountOpen]);

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
    setAccountOpen(false);
    setDrawerOpen(true);

    routes.forEach((item, index) => {
      window.setTimeout(() => {
        router.prefetch(item.href);
      }, index * 45);
    });
  }

  function openAccount() {
    setDrawerOpen(false);
    setAccountOpen(true);
    router.prefetch("/dashboard/settings?section=profile");
  }

  function goBackInstant() {
    setDrawerOpen(false);
    setAccountOpen(false);
    document.documentElement.removeAttribute("data-ficonter-route-loading");

    const stack = navigationStackRef.current;
    const workspacePrefix =
      workspace === "business" ? "/business" : "/dashboard";
    let target = stack.pop() ?? null;

    while (
      target &&
      (target === currentHref || !target.startsWith(workspacePrefix))
    ) {
      target = stack.pop() ?? null;
    }

    if (target) {
      navigatingBackRef.current = true;
      setPreviousAppPath(stack[stack.length - 1] ?? null);
      router.prefetch(target);
      router.push(target, { scroll: false });
      return;
    }

    navigationStackRef.current = [];
    setPreviousAppPath(null);

    if (currentHref === fallbackBackHref) return;

    navigatingBackRef.current = true;
    router.prefetch(fallbackBackHref);
    router.push(fallbackBackHref, { scroll: false });
  }

  async function signOut() {
    if (signingOut) return;

    setSigningOut(true);
    setDrawerOpen(false);
    setAccountOpen(false);

    const root = document.documentElement;

    root.dataset.ficonterAppDrawer = "closed";
    root.dataset.ficonterAccountMenu = "closed";
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
        <div className={styles.brandMark}>
          <img
            className={styles.headerMark}
            src="/ficonter-mark.svg"
            alt="FICONTER"
            width={30}
            height={30}
          />
        </div>

        <div className={`${styles.routeIdentity} ${showBackCommand ? styles.routeIdentityWithBack : ""}`}>
          {showBackCommand ? (
            <button
              type="button"
              className={styles.backButton}
              onPointerDown={() => {
                if (previousAppPath) router.prefetch(previousAppPath);
                else router.prefetch(fallbackBackHref);
              }}
              onClick={goBackInstant}
              aria-label="Go back"
              title="Back"
            >
              <ArrowLeft size={20} aria-hidden={true} />
            </button>
          ) : null}
          <div className={styles.routeCopy}>
            <span className={styles.routeEyebrow}>
              {isAdminRoute ? "ADMIN" : workspace === "business" ? "BUSINESS" : "PERSONAL"} · FICONTER
            </span>
            <strong>{route.title}</strong>
          </div>
        </div>

        <button
          ref={accountButtonRef}
          type="button"
          className={styles.workspaceBadge}
          title={`${accountName} — account`}
          aria-label={`Open profile menu for ${accountName}`}
          aria-expanded={accountOpen}
          aria-controls="ficonter-account-sheet"
          onClick={openAccount}
        >
          {avatarUrl ? (
            <img
              className={styles.workspaceAvatarImage}
              src={avatarUrl}
              alt=""
              aria-hidden="true"
            />
          ) : (
            <span>{accountInitial}</span>
          )}
        </button>

        {workspace === "business" && businessProfiles.length ? (
          <div className={styles.businessProfileBar}>
            <span className={styles.businessProfileIcon} aria-hidden="true">
              <Building2 size={16} />
            </span>
            <span className={styles.businessProfileLabel}>Active business</span>
            <select
              value={displayedBusinessId || activeBusinessId || businessProfiles[0]?.id || ""}
              onChange={(event) => void switchBusiness(event.target.value)}
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
            {businessSwitchError ? (
              <small className={styles.businessSwitchToast} role="status" aria-live="polite">
                {businessSwitchError}
              </small>
            ) : null}
          </div>
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
          aria-label="Add transaction"
          title="Add transaction"
          onClick={() => {
            if (pathname === transactionsHref) {
              if (currentHref !== addHref) {
                router.replace(addHref, { scroll: false });
              }
              window.requestAnimationFrame(() => {
                window.dispatchEvent(new Event(quickAddEventName));
              });
              return;
            }

            router.prefetch(addHref);
            router.push(addHref, { scroll: false });
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
          ref={moreButtonRef}
          type="button"
          className={`${styles.dockItem} ${
            moreActive ? styles.dockActive : ""
          }`}
          onClick={openDrawer}
          aria-label="Open all sections"
          aria-expanded={drawerOpen}
          aria-controls="ficonter-app-drawer"
        >
          <LayoutGrid size={21} aria-hidden={true} />
          <span>More</span>
        </button>
      </nav>

      <button
        type="button"
        className={`${styles.backdrop} ${
          drawerOpen || accountOpen ? styles.backdropOpen : ""
        }`}
        onClick={() => {
          const closingAccount = accountOpen;
          setDrawerOpen(false);
          setAccountOpen(false);
          window.requestAnimationFrame(() => {
            if (closingAccount) {
              accountButtonRef.current?.focus({ preventScroll: true });
            } else {
              moreButtonRef.current?.focus({ preventScroll: true });
            }
          });
        }}
        aria-label={accountOpen ? "Close profile menu" : "Close app navigation"}
        tabIndex={drawerOpen || accountOpen ? 0 : -1}
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
                moreButtonRef.current?.focus({ preventScroll: true });
              });
            }}
            aria-label="Close app navigation"
          >
            <X size={22} aria-hidden={true} />
          </button>
        </div>

        {workspace === "business" && businessProfiles.length ? (
          <div className={styles.drawerBusinessSelector}>
            <span>Business profile</span>
            <select
              value={displayedBusinessId || activeBusinessId || businessProfiles[0]?.id || ""}
              onChange={(event) => void switchBusiness(event.target.value)}
              disabled={switchingBusiness}
              aria-label="Change active business profile"
            >
              {businessProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
            {businessSwitchError ? (
              <small className={styles.businessProfileError} role="status" aria-live="polite">
                {businessSwitchError}
              </small>
            ) : null}
          </div>
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

      <aside
        ref={accountSheetRef}
        id="ficonter-account-sheet"
        className={`${styles.drawer} ${styles.accountSheet} ${
          accountOpen ? styles.drawerOpen : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Profile menu"
        aria-hidden={!accountOpen}
        inert={!accountOpen}
      >
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.accountSheetHeader}>
          <span className={styles.accountSheetAvatar} aria-hidden="true">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              accountInitial
            )}
          </span>
          <div>
            <span>ACCOUNT</span>
            <strong>{accountName}</strong>
            <small>{email || "FICONTER"}</small>
          </div>
          <button
            ref={accountCloseButtonRef}
            type="button"
            className={styles.accountSheetClose}
            onClick={() => {
              setAccountOpen(false);
              window.requestAnimationFrame(() => {
                accountButtonRef.current?.focus({ preventScroll: true });
              });
            }}
            aria-label="Close profile menu"
          >
            <X size={21} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.accountActions}>
          <Link
            href="/dashboard/settings?section=profile"
            prefetch={true}
            className={styles.accountAction}
            onClick={() => setAccountOpen(false)}
          >
            <span className={styles.accountActionIcon}><UserRound size={19} aria-hidden="true" /></span>
            <span><strong>Profile</strong><small>Account preferences</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
          <Link
            href="/dashboard/settings"
            prefetch={true}
            className={styles.accountAction}
            onClick={() => setAccountOpen(false)}
          >
            <span className={styles.accountActionIcon}><Settings2 size={19} aria-hidden="true" /></span>
            <span><strong>Settings</strong><small>Account, preferences and privacy</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className={`${styles.accountAction} ${styles.accountActionDanger}`}
            onClick={() => void signOut()}
            disabled={signingOut}
          >
            <span className={styles.accountActionIcon}><LogOut size={19} aria-hidden="true" /></span>
            <span><strong>{signingOut ? "Signing out…" : "Log out"}</strong><small>End this FICONTER session</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </aside>
    </>
  );
}
