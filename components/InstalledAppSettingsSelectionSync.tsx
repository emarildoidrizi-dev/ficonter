"use client";

import { useEffect } from "react";
import { isInstalledStandaloneApp } from "@/lib/pwaRuntimeRecovery";
import {
  currentFiconterSettingsSection,
  primeFiconterSettingsParent,
  primeFiconterSettingsSection,
  settleFiconterNavigationVisual,
  type FiconterSettingsSection,
} from "@/lib/navigationRuntime";
import { normalizeAppearance, normalizeSurfaceOpacity, resolveAppearance } from "@/lib/interfaceThemes";

type SectionId = FiconterSettingsSection;

const sectionByLabel = new Map<string, SectionId>([
  ["Profile", "profile"],
  ["Account & security", "security"],
  ["Financial preferences", "financial"],
  ["Notifications", "notifications"],
  ["Appearance", "appearance"],
  ["Data & privacy", "privacy"],
  ["Subscription", "subscription"],
]);

function buttons() {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      'aside[aria-label="Settings sections"] button',
    ),
  ).filter((button) =>
    sectionByLabel.has(button.querySelector("strong")?.textContent?.trim() ?? ""),
  );
}

function sectionFor(button: HTMLButtonElement) {
  const explicit = button.dataset.ficonterSettingsSection as SectionId | undefined;
  if (explicit) return explicit;
  return (
    sectionByLabel.get(
      button.querySelector("strong")?.textContent?.trim() ?? "",
    ) ?? null
  );
}

function sectionFromLocation() {
  const value = new URL(window.location.href).searchParams.get("section") ?? "";
  return Array.from(sectionByLabel.values()).includes(value as SectionId)
    ? (value as SectionId)
    : null;
}

function sectionFromReactState() {
  const activeButton = buttons().find((button) =>
    Array.from(button.classList).some((name) => name.includes("sectionActive")),
  );
  return activeButton ? sectionFor(activeButton) : null;
}

function setDetail(open: boolean) {
  document
    .querySelector<HTMLElement>('[class*="SettingsWorkspace_workspace"]')
    ?.setAttribute("data-mobile-detail", open ? "true" : "false");
}

function setSelection(section: SectionId) {
  for (const button of buttons()) {
    const buttonSection = sectionFor(button);
    const selected = buttonSection === section;
    if (buttonSection) button.dataset.ficonterSettingsSection = buttonSection;
    button.dataset.ficonterSettingsRow = "true";
    button.dataset.ficonterSettingsSelected = selected ? "true" : "false";
    button.classList.remove("ficonter-auto-contrast");
    button.style.removeProperty("--ficonter-auto-text");

    for (const child of button.querySelectorAll<HTMLElement>("*")) {
      child.classList.remove("ficonter-auto-contrast");
      child.style.removeProperty("--ficonter-auto-text");
    }

    if (selected) {
      button.dataset.ficonterContrastIgnore = "true";
      button.setAttribute("aria-current", "page");
    } else {
      delete button.dataset.ficonterContrastIgnore;
      button.removeAttribute("aria-current");
    }
  }
}

function restoreCommittedTheme() {
  if (window.location.pathname !== "/dashboard/settings") return;
  const root = document.documentElement;

  try {
    const stored = localStorage.getItem("ficonter-appearance");
    if (!stored) return;

    const appearance = normalizeAppearance(stored);
    const resolved = resolveAppearance(
      appearance,
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );

    root.dataset.ficonterSettingsBackSync = "true";
    root.dataset.theme = appearance;
    root.dataset.resolvedTheme = resolved;
    root.style.colorScheme = resolved;

    const density = localStorage.getItem("ficonter-density");
    const motion = localStorage.getItem("ficonter-background-motion");
    const wallpaper = localStorage.getItem("ficonter-wallpaper-scene");
    const opacity = localStorage.getItem("ficonter-surface-opacity");

    if (density) root.dataset.density = density;
    if (motion) root.dataset.backgroundMotion = motion;
    if (wallpaper) root.dataset.wallpaperScene = wallpaper;
    if (opacity) {
      const normalized = normalizeSurfaceOpacity(opacity);
      root.dataset.surfaceOpacity = String(normalized);
      root.style.setProperty("--ficonter-surface-opacity", `${normalized}%`);
    }

    window.setTimeout(() => delete root.dataset.ficonterSettingsBackSync, 48);
  } catch {
    // Navigation remains independent from storage availability.
  }
}

export function InstalledAppSettingsSelectionSync() {
  useEffect(() => {
    const root = document.documentElement;
    if (
      !isInstalledStandaloneApp() ||
      root.dataset.ficonterDevice !== "phone" ||
      root.dataset.ficonterDisplayMode !== "standalone"
    ) {
      return;
    }

    let lastSelected: SectionId =
      sectionFromLocation() ??
      currentFiconterSettingsSection() ??
      sectionFromReactState() ??
      "security";

    const showDetail = (section: SectionId) => {
      lastSelected = section;
      setSelection(section);
      setDetail(true);
    };

    const showParent = () => {
      setSelection(lastSelected);
      setDetail(false);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;

      const backButton = event.target.closest<HTMLButtonElement>(
        'button[aria-label="Go back"]',
      );
      if (backButton && window.location.pathname === "/dashboard/settings") {
        lastSelected =
          currentFiconterSettingsSection() ??
          sectionFromReactState() ??
          sectionFromLocation() ??
          lastSelected;
        restoreCommittedTheme();
        primeFiconterSettingsParent(lastSelected);
        showParent();
        return;
      }

      const button = event.target.closest<HTMLButtonElement>(
        'aside[aria-label="Settings sections"] button',
      );
      if (!button) return;

      const section = sectionFor(button);
      if (!section) return;

      restoreCommittedTheme();
      primeFiconterSettingsSection(section);
      showDetail(section);
    };

    const handlePopState = () => {
      restoreCommittedTheme();
      const route = `${window.location.pathname}${window.location.search}`;
      const section = sectionFromLocation();

      if (section) {
        lastSelected = section;
        primeFiconterSettingsSection(section);
        settleFiconterNavigationVisual(route);
        showDetail(section);
        return;
      }

      primeFiconterSettingsParent(lastSelected);
      settleFiconterNavigationVisual(route);
      showParent();
    };

    const initialSection = sectionFromLocation();
    if (initialSection) {
      lastSelected = initialSection;
      primeFiconterSettingsSection(initialSection);
      settleFiconterNavigationVisual(
        `${window.location.pathname}${window.location.search}`,
      );
      showDetail(initialSection);
    } else {
      primeFiconterSettingsParent(lastSelected);
      settleFiconterNavigationVisual(
        `${window.location.pathname}${window.location.search}`,
      );
      showParent();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("popstate", handlePopState);
      delete root.dataset.ficonterSettingsBackSync;
    };
  }, []);

  return <style>{`
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-row="true"] { background: transparent !important; color: var(--ink) !important; transition: none !important; }
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-row="true"] small,
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-row="true"] > svg { color: var(--text-secondary) !important; transition: none !important; }
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-selected="true"] { background: var(--solid-bg) !important; color: var(--solid-text) !important; }
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-selected="true"] strong,
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-selected="true"] small,
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-selected="true"] > svg { color: var(--solid-text) !important; }
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-selected="true"] > span:first-of-type { border-color: rgba(255,255,255,.12) !important; background: rgba(255,255,255,.08) !important; color: var(--gold) !important; }
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-settings-back-sync="true"],
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-settings-back-sync="true"] * { transition-duration: 0ms !important; transition-delay: 0ms !important; }
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-display-mode="standalone"][data-ficonter-nav-transition="active"] .app-main > .ficonter-settings-page { animation: none !important; opacity: 1 !important; transform: none !important; }
  `}</style>;
}
