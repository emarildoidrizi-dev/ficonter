"use client";

import {
  Bell,
  ChevronRight,
  CircleUserRound,
  CreditCard,
  Database,
  LockKeyhole,
  Palette,
  WalletCards,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

import type { SubscriptionFeature } from "@/lib/subscriptionPlans";
import { SettingsWorkspace } from "./SettingsWorkspace";
import styles from "./PhoneSettingsWorkspace.module.css";

type Metadata = Record<string, unknown>;

type SubscriptionSnapshot = {
  plan_code?: string | null;
  status?: string | null;
  billing_interval?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  provider?: string | null;
};

type Props = {
  userId: string;
  email: string;
  metadata: Metadata;
  initialBaseCurrency?: string;
  initialSection?: string;
  subscription?: SubscriptionSnapshot | null;
  requiredFeature?: SubscriptionFeature | null;
  isSubscriptionExempt?: boolean;
  canManageWallpapers?: boolean;
};

type SectionId =
  | "profile"
  | "security"
  | "financial"
  | "notifications"
  | "appearance"
  | "privacy"
  | "subscription";

type TapState = {
  id: SectionId;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
};

const TAP_MOVE_TOLERANCE = 8;

const SECTIONS = [
  {
    id: "profile",
    label: "Profile",
    description: "Profile photo",
    icon: CircleUserRound,
  },
  {
    id: "security",
    label: "Account & security",
    description: "Login, password and sessions",
    icon: LockKeyhole,
  },
  {
    id: "financial",
    label: "Financial preferences",
    description: "Currency, formats and planner",
    icon: WalletCards,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Reminders and summaries",
    icon: Bell,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme, motion and density",
    icon: Palette,
  },
  {
    id: "privacy",
    label: "Data & privacy",
    description: "Exports and account controls",
    icon: Database,
  },
  {
    id: "subscription",
    label: "Subscription",
    description: "Plan and billing",
    icon: CreditCard,
  },
] as const;

function isSectionId(value: string | null | undefined): value is SectionId {
  return SECTIONS.some((section) => section.id === value);
}

function isPhoneRuntime() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const root = document.documentElement;
  if (
    root.dataset.ficonterNativeApp === "true" &&
    root.dataset.ficonterDevice === "phone"
  ) {
    return true;
  }

  const width = Math.max(
    1,
    Math.round(
      window.visualViewport?.width ||
        window.innerWidth ||
        document.documentElement.clientWidth,
    ),
  );

  return width <= 640;
}

function sectionFromLocation(isSubscriptionExempt: boolean): SectionId | null {
  if (typeof window === "undefined") return null;

  const value = new URL(window.location.href).searchParams.get("section");
  if (!isSectionId(value)) return null;
  if (isSubscriptionExempt && value === "subscription") return "security";
  return value;
}

function setPageDetailState(open: boolean) {
  if (typeof document === "undefined") return;
  const page = document.querySelector<HTMLElement>(".ficonter-settings-page");
  if (page) page.dataset.settingsDetail = open ? "true" : "false";
  document.documentElement.removeAttribute("data-ficonter-route-loading");
}

function replaceSettingsSectionInUrl(section: SectionId | null) {
  const current = new URL(window.location.href);
  if (current.pathname !== "/dashboard/settings") return;

  if (section) {
    current.searchParams.set("section", section);
  } else {
    current.searchParams.delete("section");
  }

  const search = current.searchParams.toString();
  const next = `${current.pathname}${search ? `?${search}` : ""}${current.hash}`;
  const now = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (next !== now) {
    // Internal Settings state must never add a navigation entry. The URL mirrors
    // the already-committed local UI state and is not an authority for it.
    window.history.replaceState(window.history.state, "", next);
  }
}

export function PhoneSettingsWorkspace(props: Props) {
  const {
    email,
    metadata,
    initialSection,
    isSubscriptionExempt = false,
  } = props;

  const [phoneRuntime, setPhoneRuntime] = useState(false);
  const initialValidSection =
    isSectionId(initialSection) &&
    !(isSubscriptionExempt && initialSection === "subscription")
      ? initialSection
      : null;
  const [active, setActive] = useState<SectionId>(
    initialValidSection ?? "security",
  );
  const [detailOpen, setDetailOpen] = useState(Boolean(initialValidSection));
  const detailOpenRef = useRef(Boolean(initialValidSection));
  const tapRef = useRef<TapState | null>(null);
  const suppressClickRef = useRef<SectionId | null>(null);

  const visibleSections = useMemo(
    () =>
      isSubscriptionExempt
        ? SECTIONS.filter((section) => section.id !== "subscription")
        : [...SECTIONS],
    [isSubscriptionExempt],
  );

  useLayoutEffect(() => {
    const resolve = () => setPhoneRuntime(isPhoneRuntime());
    resolve();

    window.addEventListener("resize", resolve);
    window.visualViewport?.addEventListener("resize", resolve);

    return () => {
      window.removeEventListener("resize", resolve);
      window.visualViewport?.removeEventListener("resize", resolve);
    };
  }, []);

  useEffect(() => {
    if (!phoneRuntime) return;

    const synchronizeFromLocation = () => {
      const nextSection = sectionFromLocation(isSubscriptionExempt);

      flushSync(() => {
        if (nextSection) {
          detailOpenRef.current = true;
          setActive(nextSection);
          setDetailOpen(true);
        } else {
          // Genuine browser history can reveal the parent, but it never resets
          // the last active row.
          detailOpenRef.current = false;
          setDetailOpen(false);
        }
      });

      setPageDetailState(Boolean(nextSection));
    };

    window.addEventListener("popstate", synchronizeFromLocation);
    return () => window.removeEventListener("popstate", synchronizeFromLocation);
  }, [phoneRuntime, isSubscriptionExempt]);

  useEffect(() => {
    if (!phoneRuntime) return;

    const findBackButton = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLButtonElement>('button[aria-label="Go back"]')
        : null;

    const isInternalSettingsBack = () => {
      const current = new URL(window.location.href);
      return (
        current.pathname === "/dashboard/settings" &&
        (detailOpenRef.current || current.searchParams.has("section"))
      );
    };

    const handleBackPointerDown = (event: PointerEvent) => {
      if (!findBackButton(event.target) || !isInternalSettingsBack()) return;

      // Keep the global app Back system out of the physical press. The Settings
      // parent is already mounted, so this is only a local visibility change.
      event.stopPropagation();
      event.stopImmediatePropagation();

      detailOpenRef.current = false;
      flushSync(() => setDetailOpen(false));
      setPageDetailState(false);
    };

    const handleBackClick = (event: MouseEvent) => {
      if (!findBackButton(event.target) || !isInternalSettingsBack()) return;

      // This capture listener stays mounted for the full phone Settings session,
      // even after pointerdown closes the detail. Therefore the app-level Back
      // handler can never receive this internal Settings click.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (detailOpenRef.current) {
        detailOpenRef.current = false;
        flushSync(() => setDetailOpen(false));
        setPageDetailState(false);
      }

      // No history.back(), router.push() or route transition. The URL is merely
      // cleaned after the UI state has already been committed.
      replaceSettingsSectionInUrl(null);
    };

    document.addEventListener("pointerdown", handleBackPointerDown, true);
    document.addEventListener("click", handleBackClick, true);

    return () => {
      document.removeEventListener("pointerdown", handleBackPointerDown, true);
      document.removeEventListener("click", handleBackClick, true);
    };
  }, [phoneRuntime]);

  function openSection(id: SectionId) {
    if (isSubscriptionExempt && id === "subscription") return;

    // This is the sole visual authority on phones. It commits before URL,
    // search params or any route system can participate.
    detailOpenRef.current = true;
    flushSync(() => {
      setActive(id);
      setDetailOpen(true);
    });
    setPageDetailState(true);

    // A subsection is not a route transition. Mirror the local selection in the
    // address bar without adding to browser history.
    replaceSettingsSectionInUrl(id);
  }

  function beginTap(event: React.PointerEvent<HTMLButtonElement>, id: SectionId) {
    if (!phoneRuntime || event.button !== 0) return;

    tapRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  }

  function trackTap(event: React.PointerEvent<HTMLButtonElement>) {
    const tap = tapRef.current;
    if (!tap || tap.pointerId !== event.pointerId) return;

    if (
      Math.abs(event.clientX - tap.startX) > TAP_MOVE_TOLERANCE ||
      Math.abs(event.clientY - tap.startY) > TAP_MOVE_TOLERANCE
    ) {
      tap.moved = true;
    }
  }

  function completeTap(
    event: React.PointerEvent<HTMLButtonElement>,
    id: SectionId,
  ) {
    const tap = tapRef.current;
    tapRef.current = null;

    if (
      !phoneRuntime ||
      !tap ||
      tap.id !== id ||
      tap.pointerId !== event.pointerId ||
      tap.moved
    ) {
      return;
    }

    event.preventDefault();
    suppressClickRef.current = id;
    openSection(id);
  }

  function handleClick(event: React.MouseEvent<HTMLButtonElement>, id: SectionId) {
    if (phoneRuntime && suppressClickRef.current === id) {
      suppressClickRef.current = null;
      event.preventDefault();
      return;
    }

    openSection(id);
  }

  if (!phoneRuntime) {
    return <SettingsWorkspace {...props} />;
  }

  const displayName = String(
    metadata.display_name ?? metadata.full_name ?? metadata.name ?? "Ficonter member",
  ).trim();
  const avatarText = (displayName || email || "F").slice(0, 1).toUpperCase();

  return (
    <div className={styles.root} data-phone-settings-detail={detailOpen ? "true" : "false"}>
      <section
        className={detailOpen ? styles.hidden : styles.menu}
        aria-label="Settings sections"
        data-ficonter-contrast-ignore="true"
      >
        <div className={styles.accountCard}>
          <div className={styles.avatar} aria-hidden="true">{avatarText}</div>
          <div className={styles.accountCopy}>
            <strong>{displayName || "Ficonter member"}</strong>
            <span>{email}</span>
          </div>
        </div>

        <div className={styles.sectionList}>
          {visibleSections.map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`${styles.sectionButton}${active === id ? ` ${styles.active}` : ""}`}
              onPointerDown={(event) => beginTap(event, id)}
              onPointerMove={trackTap}
              onPointerCancel={() => {
                tapRef.current = null;
              }}
              onPointerUp={(event) => completeTap(event, id)}
              onClick={(event) => handleClick(event, id)}
              aria-current={active === id ? "page" : undefined}
            >
              <span className={styles.sectionIcon}><Icon size={17} /></span>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </section>

      <div className={detailOpen ? styles.detailHost : styles.hidden}>
        <SettingsWorkspace {...props} initialSection={active} />
      </div>
    </div>
  );
}
