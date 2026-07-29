"use client";

import { useLayoutEffect } from "react";
import {
  normalizeAppearance,
  resolveAppearance,
  type AppearancePreference,
} from "@/lib/interfaceThemes";
import {
  normalizeInterfaceLayout,
  type InterfaceLayoutPreference,
} from "@/lib/interfaceLayout";

type DensityPreference = "comfortable" | "compact";

type Props = {
  appearance?: string | null;
  density?: string | null;
  layout?: string | null;
};

function normalizeDensity(value: string | null | undefined): DensityPreference {
  return value === "compact" ? "compact" : "comfortable";
}

function applyPreferences(
  appearance: AppearancePreference,
  density: DensityPreference,
  layout: InterfaceLayoutPreference,
) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = resolveAppearance(appearance, prefersDark);

  root.dataset.theme = appearance;
  root.dataset.resolvedTheme = resolvedTheme;
  root.dataset.density = density;
  root.dataset.layout = layout;
  root.style.colorScheme = resolvedTheme;

  try {
    localStorage.setItem("ficonter-appearance", appearance);
    localStorage.setItem("ficonter-density", density);
    localStorage.setItem("ficonter-layout", layout);
  } catch {
    // Browsers can block storage in strict privacy modes. The live DOM state still applies.
  }
}

export function InterfacePreferencesBootstrap({ appearance, density, layout }: Props) {
  useLayoutEffect(() => {
    const storedAppearance = (() => {
      try {
        return localStorage.getItem("ficonter-appearance");
      } catch {
        return null;
      }
    })();
    const storedDensity = (() => {
      try {
        return localStorage.getItem("ficonter-density");
      } catch {
        return null;
      }
    })();
    const storedLayout = (() => {
      try {
        return localStorage.getItem("ficonter-layout");
      } catch {
        return null;
      }
    })();

    let currentAppearance = normalizeAppearance(storedAppearance ?? appearance);
    let currentDensity = normalizeDensity(storedDensity ?? density);
    let currentLayout = normalizeInterfaceLayout(storedLayout ?? layout);
    applyPreferences(currentAppearance, currentDensity, currentLayout);

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleMediaChange = () => {
      if (currentAppearance === "system") {
        applyPreferences(currentAppearance, currentDensity, currentLayout);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "ficonter-appearance") {
        currentAppearance = normalizeAppearance(event.newValue);
      }
      if (event.key === "ficonter-density") {
        currentDensity = normalizeDensity(event.newValue);
      }
      if (event.key === "ficonter-layout") {
        currentLayout = normalizeInterfaceLayout(event.newValue);
      }
      if (
        event.key === "ficonter-appearance" ||
        event.key === "ficonter-density" ||
        event.key === "ficonter-layout"
      ) {
        applyPreferences(currentAppearance, currentDensity, currentLayout);
      }
    };

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          appearance?: string;
          density?: string;
          layout?: string;
        }>
      ).detail;
      currentAppearance = normalizeAppearance(
        detail?.appearance ?? currentAppearance,
      );
      currentDensity = normalizeDensity(detail?.density ?? currentDensity);
      currentLayout = normalizeInterfaceLayout(detail?.layout ?? currentLayout);
      applyPreferences(currentAppearance, currentDensity, currentLayout);
    };

    media.addEventListener("change", handleMediaChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      "ficonter:preferences-updated",
      handlePreferencesUpdated,
    );

    return () => {
      media.removeEventListener("change", handleMediaChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "ficonter:preferences-updated",
        handlePreferencesUpdated,
      );
    };
  }, [appearance, density, layout]);

  return null;
}
