"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarRange,
  ChartNoAxesCombined,
  ChevronRight,
  Plus,
  CreditCard,
  Database,
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
  Palette,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  WalletCards,
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
import { LanguageSelector } from "./LanguageSelector";
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
  avatarPath?: string;
  businessName?: string;
  businessProfiles?: BusinessProfileOption[];
  activeBusinessId?: string | null;
  subscriptionPlanCode: SubscriptionPlanCode;
};

type ProfileUpdatedDetail = {
  profilePhotoPath?: string;
};

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

type DeviceClass = "phone" | "tablet" | "desktop";

const PERSONAL_HOME_HREF = "/dashboard/overview";

const personalRoutes: RouteItem[] = [
  {
    href: PERSONAL_HOME_HREF,
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
  {
    href: "/dashboard/profile",
    label: "Profile",
    title: "Profile",
    icon: UserRound,
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

const personalSettingsQuickRoutes = [
  {
    href: "/dashboard/settings?section=security",
    label: "Account & security",
    description: "Login, password and sessions",
    icon: LockKeyhole,
  },
  {
    href: "/dashboard/settings?section=financial",
    label: "Financial preferences",
    description: "Currency, formats and planner",
    icon: WalletCards,
  },
  {
    href: "/dashboard/settings?section=notifications",
    label: "Notifications",
    description: "Reminders and summaries",
    icon: Bell,
  },
  {
    href: "/dashboard/settings?section=appearance",
    label: "Appearance",
    description: "Theme, motion and density",
    icon: Palette,
  },
  {
    href: "/dashboard/settings?section=privacy",
    label: "Data & privacy",
    description: "Exports and account controls",
    icon: Database,
  },
] as const;

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

    return pathname === "/dashboard" || pathname === PERSONAL_HOME_HREF;
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
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [avatarPhotoPath, setAvatarPhotoPath] = useState(avatarPath);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [switchingBusiness, setSwitchingBusiness] = useState(false);
  const [businessSwitchError, setBusinessSwitchError] = useState("");
  const [selectedBusinessId, setSelectedBusinessId] = useState(
    activeBusinessId ?? "",
  );
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseButtonRef = useRef<HTMLButtonElement>(null);
  const accountCloseButtonRef = useRef<HTMLButtonElement>(null);
  const settingsCloseButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const accountSheetRef = useRef<HTMLElement>(null);
  const settingsSheetRef = useRef<HTMLElement>(null);

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

  const settingsActive =
    workspace === "personal" && settingsOpen;

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
      ? PERSONAL_HOME_HREF
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
    setAvatarPhotoPath(avatarPath);
  }, [avatarPath]);

  useEffect(() => {
    let active = true;

    async function loadAvatar() {
      if (!avatarPhotoPath) {
        if (active) setAvatarUrl("");
        return;
      }

      const { data, error } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(avatarPhotoPath, 60 * 60);

      if (active) {
        setAvatarUrl(error ? "" : data.signedUrl);
      }
    }

    void loadAvatar();
    return () => {
      active = false;
    };
  }, [avatarPhotoPath, supabase]);

  useEffect(() => {
    function handleProfileUpdate(event: Event) {
      const detail = (event as CustomEvent<ProfileUpdatedDetail>).detail;
      if (typeof detail?.profilePhotoPath === "string") {
        setAvatarPhotoPath(detail.profilePhotoPath);
      }
    }

    window.addEventListener("ficonter:profile-updated", handleProfileUpdate);
    return () =>
      window.removeEventListener("ficonter:profile-updated", handleProfileUpdate);
  }, []);

  useEffect(() => {
    function handleOpenSettingsMenu() {
      setDrawerOpen(false);
      setAccountOpen(false);
      setSettingsOpen(true);

      personalSettingsQuickRoutes.forEach((item, index) => {
        window.setTimeout(() => {
          router.prefetch(item.href);
        }, index * 35);
      });
    }

    window.addEventListener(
      "ficonter:open-settings-menu",
      handleOpenSettingsMenu,
    );
    return () =>
      window.removeEventListener(
        "ficonter:open-settings-menu",
        handleOpenSettingsMenu,
      );
  }, [router]);


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
    setAccountOpen(false);
    setSettingsOpen(false);
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
  }, [accountOpen]);

  useEffect(() => {
    if (!settingsOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
        window.requestAnimationFrame(() => {
          settingsButtonRef.current?.focus({ preventScroll: true });
        });
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        settingsSheetRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
  }, [settingsOpen]);

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
    document.documentElement.dataset.ficonterSettingsMenu =
      settingsOpen ? "open" : "closed";

    if (settingsOpen) {
      window.requestAnimationFrame(() => {
        settingsCloseButtonRef.current?.focus({ preventScroll: true });
      });
    }

    return () => {
      document.documentElement.dataset.ficonterSettingsMenu = "closed";
    };
  }, [settingsOpen]);

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
    setSettingsOpen(false);
    setDrawerOpen(true);

    routes.forEach((item, index) => {
      window.setTimeout(() => {
        router.prefetch(item.href);
      }, index * 45);
    });
  }

  function openAccount() {
    setDrawerOpen(false);
    setSettingsOpen(false);
    setAccountOpen(true);
    router.prefetch("/dashboard/profile");
  }

  function toggleSettings() {
    if (settingsOpen) {
      setSettingsOpen(false);
      window.requestAnimationFrame(() => {
        settingsButtonRef.current?.focus({ preventScroll: true });
      });
      return;
    }

    setDrawerOpen(false);
    setAccountOpen(false);
    setSettingsOpen(true);

    personalSettingsQuickRoutes.forEach((item, index) => {
      window.setTimeout(() => {
        router.prefetch(item.href);
      }, index * 35);
    });
  }

  function goHomeInstant() {
    setDrawerOpen(false);
    setAccountOpen(false);
    setSettingsOpen(false);
    document.documentElement.removeAttribute("data-ficonter-route-loading");

    // Home is /dashboard/overview. Avoid the legacy /dashboard redirect because
    // it causes an unnecessary second navigation and loading-state flash.
    if (pathname === PERSONAL_HOME_HREF || pathname === "/dashboard") {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    router.prefetch(PERSONAL_HOME_HREF);
    router.push(PERSONAL_HOME_HREF, { scroll: false });
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
    setAccountOpen(false);
    setSettingsOpen(false);

    const root = document.documentElement;

    root.dataset.ficonterAppDrawer = "closed";
    root.dataset.ficonterAccountMenu = "closed";
    root.dataset.ficonterSettingsMenu = "closed";
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
        <div className={styles.brandMark} aria-hidden="true">
          <img
            className={styles.headerMark}
            src="/ficonter-app-icon.png"
            alt=""
            width={52}
            height={52}
          />
        </div>

        <div className={styles.routeIdentity}>
          <span className={styles.routeEyebrow}>
            {workspace === "business" ? "BUSINESS" : "PERSONAL"} · FICONTER
          </span>
          <strong>{route.title}</strong>
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.menuButton}
            onClick={openDrawer}
            aria-label="Open app navigation"
            aria-expanded={drawerOpen}
            aria-controls="ficonter-app-drawer"
          >
            <Menu size={26} aria-hidden={true} />
          </button>
        </div>

        <div className={styles.headerLanguage}>
          <LanguageSelector variant="icon" />
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

          if (workspace === "personal" && item.href === PERSONAL_HOME_HREF) {
            return (
              <button
                key={item.href}
                type="button"
                className={`${styles.dockItem} ${
                  active ? styles.dockActive : ""
                }`}
                aria-current={active ? "page" : undefined}
                aria-label="Open Home instantly"
                onPointerDown={() => router.prefetch(PERSONAL_HOME_HREF)}
                onClick={goHomeInstant}
              >
                <Icon size={21} aria-hidden={true} />
                <span>{item.label}</span>
              </button>
            );
          }

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
          <Plus size={30} aria-hidden={true} />
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

        {workspace === "personal" ? (
          <button
            ref={settingsButtonRef}
            type="button"
            className={`${styles.dockItem} ${
              settingsActive ? styles.dockActive : ""
            }`}
            aria-pressed={settingsActive}
            aria-label={settingsActive ? "Close Settings" : "Open Settings"}
            aria-expanded={settingsOpen}
            aria-controls="ficonter-settings-sheet"
            onClick={toggleSettings}
          >
            <Settings2 size={21} aria-hidden={true} />
            <span>Settings</span>
          </button>
        ) : (
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
        )}
      </nav>

      <button
        type="button"
        className={`${styles.backdrop} ${
          drawerOpen || accountOpen || settingsOpen ? styles.backdropOpen : ""
        }`}
        onClick={() => {
          const closingAccount = accountOpen;
          const closingSettings = settingsOpen;
          setDrawerOpen(false);
          setAccountOpen(false);
          setSettingsOpen(false);
          window.requestAnimationFrame(() => {
            if (closingAccount) {
              accountButtonRef.current?.focus({ preventScroll: true });
            } else if (closingSettings) {
              settingsButtonRef.current?.focus({ preventScroll: true });
            } else {
              menuButtonRef.current?.focus({ preventScroll: true });
            }
          });
        }}
        aria-label={
          accountOpen
            ? "Close profile menu"
            : settingsOpen
              ? "Close Settings"
              : "Close app navigation"
        }
        tabIndex={drawerOpen || accountOpen || settingsOpen ? 0 : -1}
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
        ref={settingsSheetRef}
        id="ficonter-settings-sheet"
        className={`${styles.accountSheet} ${styles.settingsSheet} ${
          settingsOpen ? styles.accountSheetOpen : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        aria-hidden={!settingsOpen}
        inert={!settingsOpen}
      >
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.accountSheetHeader}>
          <span className={styles.settingsSheetMark} aria-hidden="true">
            <Settings2 size={22} />
          </span>
          <span className={styles.accountIdentity}>
            <small>PRIVATE PREFERENCES</small>
            <strong>Settings</strong>
            <small>Choose a section</small>
          </span>
          <button
            ref={settingsCloseButtonRef}
            type="button"
            className={styles.accountSheetClose}
            onClick={goHomeInstant}
            aria-label="Close Settings and go to Home"
          >
            <X size={22} aria-hidden={true} />
          </button>
        </div>

        <nav className={styles.settingsQuickList} aria-label="Settings sections">
          {personalSettingsQuickRoutes.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={styles.accountProfileLink}
                onClick={() => setSettingsOpen(false)}
              >
                <span className={styles.accountProfileIcon}>
                  <Icon size={20} aria-hidden={true} />
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <ChevronRight size={18} aria-hidden={true} />
              </Link>
            );
          })}
        </nav>
      </aside>

      <aside
        ref={accountSheetRef}
        id="ficonter-account-sheet"
        className={`${styles.accountSheet} ${
          accountOpen ? styles.accountSheetOpen : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Profile menu"
        aria-hidden={!accountOpen}
        inert={!accountOpen}
      >
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.accountSheetHeader}>
          <span className={styles.accountAvatar} aria-hidden="true">
            {avatarUrl ? (
              <img
                className={styles.accountAvatarImage}
                src={avatarUrl}
                alt=""
              />
            ) : (
              accountInitial
            )}
          </span>
          <span className={styles.accountIdentity}>
            <small>PROFILE</small>
            <strong>{accountName}</strong>
            <small>{email || "Signed in"}</small>
          </span>
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
            <X size={22} aria-hidden={true} />
          </button>
        </div>

        <Link
          href="/dashboard/profile"
          prefetch={true}
          className={styles.accountProfileLink}
        >
          <span className={styles.accountProfileIcon}>
            <UserRound size={20} aria-hidden={true} />
          </span>
          <span>
            <strong>Profile</strong>
            <small>Identity, profile photo and login email</small>
          </span>
          <ChevronRight size={18} aria-hidden={true} />
        </Link>

        <button
          type="button"
          className={styles.accountSheetSignOut}
          onClick={() => void signOut()}
          disabled={signingOut}
        >
          <LogOut size={19} aria-hidden={true} />
          <span>{signingOut ? "Signing out…" : "Sign out"}</span>
        </button>
      </aside>
    </>
  );
}
