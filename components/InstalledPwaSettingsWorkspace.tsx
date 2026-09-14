"use client";

import {
  Bell,
  ChevronRight,
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
import styles from "./InstalledPwaSettingsWorkspace.module.css";

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
  | "security"
  | "financial"
  | "notifications"
  | "appearance"
  | "privacy"
  | "subscription";

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

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

function isInstalledPhonePwa() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const root = document.documentElement;
  if (
    root.dataset.ficonterNativeApp === "true" &&
    root.dataset.ficonterDevice === "phone" &&
    root.dataset.ficonterDisplayMode === "standalone"
  ) {
    return true;
  }

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as IOSNavigator).standalone);
  const width = Math.max(
    1,
    Math.round(
      window.visualViewport?.width ||
        window.innerWidth ||
        document.documentElement.clientWidth,
    ),
  );

  return standalone && width <= 640;
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
}

export function InstalledPwaSettingsWorkspace(props: Props) {
  const {
    email,
    metadata,
    initialSection,
    isSubscriptionExempt = false,
  } = props;

  const [installedPhone, setInstalledPhone] = useState(false);
  const initialValidSection =
    isSectionId(initialSection) &&
    !(isSubscriptionExempt && initialSection === "subscription")
      ? initialSection
      : null;
  const [active, setActive] = useState<SectionId>(
    initialValidSection ?? "security",
  );
  const [detailOpen, setDetailOpen] = useState(Boolean(initialValidSection));
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
    const resolve = () => setInstalledPhone(isInstalledPhonePwa());
    resolve();

    const displayMode = window.matchMedia("(display-mode: standalone)");
    window.addEventListener("resize", resolve);
    window.visualViewport?.addEventListener("resize", resolve);
    displayMode.addEventListener?.("change", resolve);

    return () => {
      window.removeEventListener("resize", resolve);
      window.visualViewport?.removeEventListener("resize", resolve);
      displayMode.removeEventListener?.("change", resolve);
    };
  }, []);

  useEffect(() => {
    if (!installedPhone) return;

    const synchronizeFromLocation = () => {
      const nextSection = sectionFromLocation(isSubscriptionExempt);

      flushSync(() => {
        if (nextSection) {
          setActive(nextSection);
          setDetailOpen(true);
        } else {
          // Back to the Settings menu deliberately keeps the last active row.
          setDetailOpen(false);
        }
      });

      setPageDetailState(Boolean(nextSection));
    };

    window.addEventListener("popstate", synchronizeFromLocation);
    return () => window.removeEventListener("popstate", synchronizeFromLocation);
  }, [installedPhone, isSubscriptionExempt]);

  useEffect(() => {
    if (!installedPhone || !detailOpen) return;

    const isBackButton = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLButtonElement>('button[aria-label="Go back"]')
        : null;

    const handleBackPointerDown = (event: PointerEvent) => {
      if (!isBackButton(event.target)) return;

      // Paint the Settings parent immediately and preserve `active` exactly.
      flushSync(() => setDetailOpen(false));
      setPageDetailState(false);
    };

    const handleBackClick = (event: MouseEvent) => {
      if (!isBackButton(event.target)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const current = new URL(window.location.href);
      if (current.searchParams.has("section") && window.history.length > 1) {
        window.history.back();
        return;
      }

      current.searchParams.delete("section");
      const search = current.searchParams.toString();
      const next = `${current.pathname}${search ? `?${search}` : ""}${current.hash}`;
      window.history.replaceState(window.history.state, "", next);
    };

    document.addEventListener("pointerdown", handleBackPointerDown, true);
    document.addEventListener("click", handleBackClick, true);

    return () => {
      document.removeEventListener("pointerdown", handleBackPointerDown, true);
      document.removeEventListener("click", handleBackClick, true);
    };
  }, [detailOpen, installedPhone]);

  function openSection(id: SectionId) {
    if (isSubscriptionExempt && id === "subscription") return;

    const target = `/dashboard/settings?section=${id}`;
    const current = `${window.location.pathname}${window.location.search}`;

    flushSync(() => {
      setActive(id);
      setDetailOpen(true);
    });
    setPageDetailState(true);

    if (current !== target) {
      window.history.pushState(window.history.state, "", target);
    }
  }

  function beginTap(event: React.PointerEvent<HTMLButtonElement>, id: SectionId) {
    if (!installedPhone || event.button !== 0) return;

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
      !installedPhone ||
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
    if (installedPhone && suppressClickRef.current === id) {
      suppressClickRef.current = null;
      event.preventDefault();
      return;
    }

    openSection(id);
  }

  if (!installedPhone) {
    return <SettingsWorkspace {...props} />;
  }

  const displayName = String(
    metadata.display_name ?? metadata.full_name ?? metadata.name ?? "Ficonter member",
  ).trim();
  const avatarText = (displayName || email || "F").slice(0, 1).toUpperCase();

  return (
    <div className={styles.root} data-pwa-settings-detail={detailOpen ? "true" : "false"}>
      <section className={detailOpen ? styles.hidden : styles.menu} aria-label="Settings sections">
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
