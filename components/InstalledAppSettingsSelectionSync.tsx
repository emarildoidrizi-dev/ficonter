"use client";

import { useEffect } from "react";
import { isInstalledStandaloneApp } from "@/lib/pwaRuntimeRecovery";
import { normalizeAppearance, normalizeSurfaceOpacity, resolveAppearance } from "@/lib/interfaceThemes";

type SectionId = "profile" | "security" | "financial" | "notifications" | "appearance" | "privacy" | "subscription";

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
  return Array.from(document.querySelectorAll<HTMLButtonElement>('aside[aria-label="Settings sections"] button')).filter((button) => sectionByLabel.has(button.querySelector("strong")?.textContent?.trim() ?? ""));
}

function sectionFor(button: HTMLButtonElement) {
  return sectionByLabel.get(button.querySelector("strong")?.textContent?.trim() ?? "") ?? null;
}

function sectionFromLocation() {
  const value = new URL(window.location.href).searchParams.get("section") ?? "";
  return Array.from(sectionByLabel.values()).includes(value as SectionId) ? (value as SectionId) : null;
}

function sectionFromReactState() {
  const activeButton = buttons().find((button) =>
    Array.from(button.classList).some((name) => name.includes("sectionActive")),
  );
  return activeButton ? sectionFor(activeButton) : null;
}

function setDetail(open: boolean) {
  document.querySelector<HTMLElement>('[class*="SettingsWorkspace_workspace"]')?.setAttribute("data-mobile-detail", open ? "true" : "false");
}

function setSelection(section: SectionId | null) {
  for (const button of buttons()) {
    const selected = Boolean(section && sectionFor(button) === section);
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
    const resolved = resolveAppearance(appearance, window.matchMedia("(prefers-color-scheme: dark)").matches);
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
    // Navigation must remain instant even if storage is unavailable.
  }
}

export function InstalledAppSettingsSelectionSync() {
  useEffect(() => {
    const root = document.documentElement;
    if (!isInstalledStandaloneApp() || root.dataset.ficonterDevice !== "phone") return;

    let parentListOpen = sectionFromLocation() === null;
    let lastSelected: SectionId =
      sectionFromLocation() ?? sectionFromReactState() ?? "security";
    let optimistic: SectionId | null = null;
    let intentTimer = 0;

    const sync = () => {
      const locationSection = sectionFromLocation();
      if (locationSection) lastSelected = locationSection;

      if (parentListOpen) {
        setSelection(lastSelected);
        setDetail(false);
        return;
      }

      const section = optimistic ?? locationSection ?? lastSelected;
      setSelection(section);
      setDetail(true);
    };

    const forward = (section: SectionId) => {
      parentListOpen = false;
      optimistic = section;
      lastSelected = section;
      restoreCommittedTheme();
      setSelection(section);
      setDetail(true);
      if (intentTimer) window.clearTimeout(intentTimer);
      intentTimer = window.setTimeout(() => {
        optimistic = null;
        sync();
      }, 32);
    };

    const back = () => {
      const currentSection = optimistic ?? sectionFromLocation() ?? lastSelected;
      if (currentSection) lastSelected = currentSection;
      parentListOpen = true;
      optimistic = null;
      if (intentTimer) window.clearTimeout(intentTimer);
      restoreCommittedTheme();
      setSelection(lastSelected);
      setDetail(false);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const backButton = event.target.closest<HTMLButtonElement>('button[aria-label="Go back"]');
      if (backButton && window.location.pathname === "/dashboard/settings") {
        back();
        return;
      }
      const button = event.target.closest<HTMLButtonElement>('aside[aria-label="Settings sections"] button');
      if (!button) return;
      const section = sectionFor(button);
      if (section) forward(section);
    };

    const onPopState = () => {
      optimistic = null;
      restoreCommittedTheme();

      const locationSection = sectionFromLocation();
      if (locationSection) {
        lastSelected = locationSection;
        parentListOpen = false;
        setSelection(locationSection);
        setDetail(true);
        return;
      }

      parentListOpen = true;
      setSelection(lastSelected);
      setDetail(false);
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("popstate", onPopState);
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("popstate", onPopState);
      if (intentTimer) window.clearTimeout(intentTimer);
      delete root.dataset.ficonterSettingsBackSync;
    };
  }, []);

  return <style>{`
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-row="true"] { background: transparent !important; color: var(--ink) !important; transition: none !important; }
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-row="true"] small,
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-row="true"] > svg { color: var(--text-secondary) !important; }
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-selected="true"] { background: var(--solid-bg) !important; color: var(--solid-text) !important; }
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-selected="true"] strong,
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-selected="true"] small,
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-selected="true"] > svg { color: var(--solid-text) !important; }
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"] aside[aria-label="Settings sections"] button[data-ficonter-settings-selected="true"] > span:first-of-type { border-color: rgba(255,255,255,.12) !important; background: rgba(255,255,255,.08) !important; color: var(--gold) !important; }
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-settings-back-sync="true"],
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-settings-back-sync="true"] * { transition-duration: 0ms !important; transition-delay: 0ms !important; }
    html[data-ficonter-native-app="true"][data-ficonter-device="phone"][data-ficonter-nav-transition="active"] .app-main > .ficonter-settings-page { animation: none !important; opacity: 1 !important; transform: none !important; }
  `}</style>;
}
