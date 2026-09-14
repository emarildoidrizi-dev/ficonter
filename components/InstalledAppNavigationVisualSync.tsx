"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  closeFiconterMoreVisual,
  currentFiconterSettingsSection,
  primeFiconterMoreVisual,
  primeFiconterNavigationVisual,
  primeFiconterSettingsParent,
  settleFiconterNavigationVisual,
  type FiconterSettingsSection,
} from "@/lib/navigationRuntime";

type Workspace = "personal" | "business";

const SETTINGS_LABELS = new Map<string, FiconterSettingsSection>([
  ["Profile", "profile"],
  ["Account & security", "security"],
  ["Financial preferences", "financial"],
  ["Notifications", "notifications"],
  ["Appearance", "appearance"],
  ["Data & privacy", "privacy"],
  ["Subscription", "subscription"],
]);

function internalAnchorTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) {
    return null;
  }

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return null;

  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function tagPrimaryDock() {
  const docks = Array.from(
    document.querySelectorAll<HTMLElement>('nav[aria-label$=" app navigation"]'),
  );

  for (const dock of docks) {
    for (const item of dock.querySelectorAll<HTMLElement>("a,button")) {
      const label = item.querySelector("span")?.textContent?.trim() ?? "";
      const primary =
        label === "Overview"
          ? "overview"
          : label === "Transactions"
            ? "transactions"
            : label === "Planner"
              ? "planner"
              : label === "Sales"
                ? "sales"
                : label === "More"
                  ? "more"
                  : null;

      if (primary) item.dataset.ficonterPrimaryNav = primary;
    }
  }
}

function settingsSectionForTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const button = target.closest<HTMLButtonElement>(
    'aside[aria-label="Settings sections"] button',
  );
  if (!button) return null;

  const explicit = button.dataset.ficonterSettingsSection as
    | FiconterSettingsSection
    | undefined;
  if (explicit) return explicit;

  const label = button.querySelector("strong")?.textContent?.trim() ?? "";
  return SETTINGS_LABELS.get(label) ?? null;
}

export function InstalledAppNavigationVisualSync({
  workspace,
}: {
  workspace: Workspace;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentRoute = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const currentRouteRef = useRef(currentRoute);

  useLayoutEffect(() => {
    currentRouteRef.current = currentRoute;
    tagPrimaryDock();
    settleFiconterNavigationVisual(currentRoute);
  }, [currentRoute]);

  useLayoutEffect(() => {
    tagPrimaryDock();

    const handlePointerDown = (event: PointerEvent) => {
      const route = internalAnchorTarget(event.target);
      if (route) {
        primeFiconterNavigationVisual(route);
        return;
      }

      if (!(event.target instanceof Element)) return;

      const moreButton = event.target.closest<HTMLButtonElement>(
        'button[aria-label="Open all sections"]',
      );
      if (moreButton) {
        primeFiconterMoreVisual(workspace);
        return;
      }

      const closeDrawerButton = event.target.closest<HTMLElement>(
        '[aria-label="Close app navigation"]',
      );
      if (closeDrawerButton) {
        closeFiconterMoreVisual(currentRouteRef.current);
        return;
      }

      const settingsSection = settingsSectionForTarget(event.target);
      if (settingsSection) {
        primeFiconterNavigationVisual(
          `/dashboard/settings?section=${settingsSection}`,
        );
        return;
      }

      const backButton = event.target.closest<HTMLButtonElement>(
        'button[aria-label="Go back"]',
      );
      if (backButton && window.location.pathname === "/dashboard/settings") {
        primeFiconterSettingsParent(
          currentFiconterSettingsSection() ?? "security",
        );
      }
    };

    const handlePopState = () => {
      const route = `${window.location.pathname}${window.location.search}`;
      currentRouteRef.current = route;
      settleFiconterNavigationVisual(route);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [workspace]);

  return (
    <style>{`
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav] {
        color: var(--mobile-chrome-muted) !important;
        transition: none !important;
      }
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav]::after {
        content: none !important;
      }
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav] svg {
        color: currentColor !important;
        transform: none !important;
        transition: none !important;
      }
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="overview"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="overview"],
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="transactions"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="transactions"],
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="planner"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="planner"],
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="sales"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="sales"],
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="more"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="more"] {
        color: var(--mobile-chrome-text) !important;
      }
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="overview"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="overview"] svg,
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="transactions"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="transactions"] svg,
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="planner"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="planner"] svg,
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="sales"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="sales"] svg,
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="more"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="more"] svg {
        color: var(--mobile-chrome-accent) !important;
        transform: translateY(-1px) !important;
      }
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="overview"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="overview"]::after,
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="transactions"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="transactions"]::after,
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="planner"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="planner"]::after,
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="sales"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="sales"]::after,
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-active-primary="more"] nav[aria-label$=" app navigation"] [data-ficonter-primary-nav="more"]::after {
        content: "" !important;
        position: absolute;
        top: 3px;
        left: 50%;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--mobile-chrome-accent);
        box-shadow: 0 0 0 4px rgba(216, 189, 124, 0.08);
        transform: translateX(-50%);
      }
    `}</style>
  );
}
