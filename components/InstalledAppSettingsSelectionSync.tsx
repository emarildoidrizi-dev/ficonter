"use client";

import { useEffect } from "react";
import { isInstalledStandaloneApp } from "@/lib/pwaRuntimeRecovery";
import {
  normalizeAppearance,
  normalizeSurfaceOpacity,
  resolveAppearance,
} from "@/lib/interfaceThemes";

type SectionId =
  | "profile"
  | "security"
  | "financial"
  | "notifications"
  | "appearance"
  | "privacy"
  | "subscription";

const sectionByLabel = new Map<string, SectionId>([
  ["Profile", "profile"],
  ["Account & security", "security"],
  ["Financial preferences", "financial"],
  ["Notifications", "notifications"],
  ["Appearance", "appearance"],
  ["Data & privacy", "privacy"],
  ["Subscription", "subscription"],
]);

function settingsNavigation() {
  return document.querySelector<HTMLElement>(
    'aside[aria-label="Settings sections"]',
  );
}

function sectionButtons() {
  const navigation = settingsNavigation();
  if (!navigation) return [] as HTMLButtonElement[];

  return Array.from(
    navigation.querySelectorAll<HTMLButtonElement>("button"),
  ).filter((button) =>
    sectionByLabel.has(button.querySelector("strong")?.textContent?.trim() ?? ""),
  );
}

function sectionForButton(button: HTMLButtonElement) {
  return (
    sectionByLabel.get(button.querySelector("strong")?.textContent?.trim() ?? "") ??
    null
  );
}

function sectionFromLocation() {
  const section = new URL(window.location.href).searchParams.get("section") ?? "";
  return Array.from(sectionByLabel.values()).includes(section as SectionId)
    ? (section as SectionId)
    : null;
}

function clearManagedContrast(button: HTMLButtonElement) {
  const elements = [
    button,
    ...Array.from(button.querySelectorAll<HTMLElement>("*")),
  ];

  for (const element of elements) {
    element.classList.remove("ficonter-auto-contrast");
    element.style.removeProperty("--ficonter-auto-text");
  }
}

function applySelection(section: SectionId | null) {
  const buttons = sectionButtons();
  if (!buttons.length) return;

  let matched = false;

  for (const button of buttons) {
    const buttonSection = sectionForButton(button);
    const selected = Boolean(section && buttonSection === section);

    clearManagedContrast(button);
    button.dataset.ficonterSettingsRow = "true";
    button.dataset.ficonterSettingsSelected = selected ? "true" : "false";

    if (selected) {
      button.dataset.ficonterContrastIgnore = "true";
      button.setAttribute("aria-current", "page");
      matched = true;
    } else {
      delete button.dataset.ficonterContrastIgnore;
      button.removeAttribute("aria-current");
    }
  }

  if (matched) return;

  // On the Settings landing screen, preserve React's current section rather
  // than inventing one. This component is only the immediate visual fast path.
  const reactActive = buttons.find((button) =>
    Array.from(button.classList).some((name) => name.includes("sectionActive")),
  );

  if (reactActive) {
    clearManagedContrast(reactActive);
    reactActive.dataset.ficonterSettingsSelected = "true";
    reactActive.dataset.ficonterContrastIgnore = "true";
    reactActive.setAttribute("aria-current", "page");
  }
}

export function InstalledAppSettingsSelectionSync() {
  useEffect(() => {
    if (!isInstalledStandaloneApp()) return;
    if (document.documentElement.dataset.ficonterDevice !== "phone") return;

    let frame = 0;
    let backRestoreTimer = 0;
    let navigationObserver: MutationObserver | null = null;

    const restoreCommittedInterfaceImmediately = () => {
      if (window.location.pathname !== "/dashboard/settings") return;

      const root = document.documentElement;
      let storedAppearance = "";
      let storedDensity = "";
      let storedBackgroundMotion = "";
      let storedWallpaperScene = "";
      let storedSurfaceOpacity = "";

      try {
        storedAppearance = localStorage.getItem("ficonter-appearance") ?? "";
        storedDensity = localStorage.getItem("ficonter-density") ?? "";
        storedBackgroundMotion =
          localStorage.getItem("ficonter-background-motion") ?? "";
        storedWallpaperScene =
          localStorage.getItem("ficonter-wallpaper-scene") ?? "";
        storedSurfaceOpacity =
          localStorage.getItem("ficonter-surface-opacity") ?? "";
      } catch {
        return;
      }

      if (!storedAppearance) return;

      // A Settings back/section command should feel native: remove the visual
      // transition for this single commit, restore the last saved interface in
      // the same frame, then re-enable normal transitions immediately after.
      root.dataset.ficonterSettingsBackSync = "true";
      void root.getBoundingClientRect();

      const appearance = normalizeAppearance(storedAppearance);
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      const resolvedTheme = resolveAppearance(appearance, prefersDark);

      root.dataset.theme = appearance;
      root.dataset.resolvedTheme = resolvedTheme;
      root.style.colorScheme = resolvedTheme;

      if (storedDensity) root.dataset.density = storedDensity;
      if (storedBackgroundMotion) {
        root.dataset.backgroundMotion = storedBackgroundMotion;
      }
      if (storedWallpaperScene) {
        root.dataset.wallpaperScene = storedWallpaperScene;
      }
      if (storedSurfaceOpacity) {
        const opacity = normalizeSurfaceOpacity(storedSurfaceOpacity);
        root.dataset.surfaceOpacity = String(opacity);
        root.style.setProperty("--ficonter-surface-opacity", `${opacity}%`);
      }

      if (backRestoreTimer) window.clearTimeout(backRestoreTimer);
      backRestoreTimer = window.setTimeout(() => {
        delete root.dataset.ficonterSettingsBackSync;
        backRestoreTimer = 0;
      }, 80);
    };

    const syncFromLocation = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        applySelection(sectionFromLocation());
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;

      const backButton = event.target.closest<HTMLButtonElement>(
        'button[aria-label="Go back"]',
      );
      if (backButton && window.location.pathname === "/dashboard/settings") {
        restoreCommittedInterfaceImmediately();
        return;
      }

      const button = event.target.closest<HTMLButtonElement>(
        'aside[aria-label="Settings sections"] button',
      );
      if (!button) return;

      const section = sectionForButton(button);
      if (!section) return;

      // Leaving Appearance or any other Settings detail must also discard an
      // unsaved preview before the next screen paints.
      restoreCommittedInterfaceImmediately();

      // Paint the new selection on the same interaction frame, before React,
      // URL reconciliation, scrolling, or transition work can lag behind it.
      applySelection(section);
    };

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const backButton = event.target.closest<HTMLButtonElement>(
        'button[aria-label="Go back"]',
      );
      if (backButton && window.location.pathname === "/dashboard/settings") {
        restoreCommittedInterfaceImmediately();
        return;
      }

      const button = event.target.closest<HTMLButtonElement>(
        'aside[aria-label="Settings sections"] button',
      );
      if (!button) return;

      const section = sectionForButton(button);
      if (!section) return;
      restoreCommittedInterfaceImmediately();
      applySelection(section);
    };

    const handlePopState = () => {
      restoreCommittedInterfaceImmediately();
      syncFromLocation();
    };

    const attachNavigationObserver = () => {
      navigationObserver?.disconnect();
      const navigation = settingsNavigation();
      if (!navigation) return;

      navigationObserver = new MutationObserver(() => syncFromLocation());
      navigationObserver.observe(navigation, {
        childList: true,
        subtree: true,
      });
    };

    applySelection(sectionFromLocation());
    attachNavigationObserver();

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    const pageObserver = new MutationObserver(() => {
      if (!settingsNavigation()) return;
      attachNavigationObserver();
      syncFromLocation();
    });

    pageObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (backRestoreTimer) window.clearTimeout(backRestoreTimer);
      delete document.documentElement.dataset.ficonterSettingsBackSync;
      navigationObserver?.disconnect();
      pageObserver.disconnect();
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return (
    <style>{`
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"]
        aside[aria-label="Settings sections"]
        button[data-ficonter-settings-row="true"] {
        background: transparent !important;
        color: var(--ink) !important;
      }

      html[data-ficonter-native-app="true"][data-ficonter-device="phone"]
        aside[aria-label="Settings sections"]
        button[data-ficonter-settings-row="true"] small,
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"]
        aside[aria-label="Settings sections"]
        button[data-ficonter-settings-row="true"] > svg {
        color: var(--text-secondary) !important;
      }

      html[data-ficonter-native-app="true"][data-ficonter-device="phone"]
        aside[aria-label="Settings sections"]
        button[data-ficonter-settings-selected="true"] {
        background: var(--solid-bg) !important;
        color: var(--solid-text) !important;
      }

      html[data-ficonter-native-app="true"][data-ficonter-device="phone"]
        aside[aria-label="Settings sections"]
        button[data-ficonter-settings-selected="true"] strong,
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"]
        aside[aria-label="Settings sections"]
        button[data-ficonter-settings-selected="true"] small,
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"]
        aside[aria-label="Settings sections"]
        button[data-ficonter-settings-selected="true"] > svg {
        color: var(--solid-text) !important;
      }

      html[data-ficonter-native-app="true"][data-ficonter-device="phone"]
        aside[aria-label="Settings sections"]
        button[data-ficonter-settings-selected="true"] > span:first-of-type {
        border-color: rgba(255,255,255,.12) !important;
        background: rgba(255,255,255,.08) !important;
        color: var(--gold) !important;
      }

      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-settings-back-sync="true"],
      html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-settings-back-sync="true"] * {
        transition-duration: 0ms !important;
        transition-delay: 0ms !important;
      }
    `}</style>
  );
}
