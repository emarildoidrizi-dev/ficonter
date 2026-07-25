"use client";

import { useLayoutEffect } from "react";

type AppearancePreference = "light" | "dark" | "system";
type DensityPreference = "comfortable" | "compact";

type Props = {
  appearance?: string | null;
  density?: string | null;
};

function normalizeAppearance(value: string | null | undefined): AppearancePreference {
  return value === "dark" || value === "system" ? value : "light";
}

function normalizeDensity(value: string | null | undefined): DensityPreference {
  return value === "compact" ? "compact" : "comfortable";
}

function applyPreferences(appearance: AppearancePreference, density: DensityPreference) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = appearance === "system" ? (prefersDark ? "dark" : "light") : appearance;

  root.dataset.theme = appearance;
  root.dataset.resolvedTheme = resolvedTheme;
  root.dataset.density = density;
  root.style.colorScheme = resolvedTheme;

  try {
    localStorage.setItem("ficonter-appearance", appearance);
    localStorage.setItem("ficonter-density", density);
  } catch {
    // Browsers can block storage in strict privacy modes. The live DOM state still applies.
  }
}

export function InterfacePreferencesBootstrap({ appearance, density }: Props) {
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

    let currentAppearance = normalizeAppearance(storedAppearance ?? appearance);
    let currentDensity = normalizeDensity(storedDensity ?? density);
    applyPreferences(currentAppearance, currentDensity);

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleMediaChange = () => {
      if (currentAppearance === "system") {
        applyPreferences(currentAppearance, currentDensity);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "ficonter-appearance") {
        currentAppearance = normalizeAppearance(event.newValue);
      }
      if (event.key === "ficonter-density") {
        currentDensity = normalizeDensity(event.newValue);
      }
      if (event.key === "ficonter-appearance" || event.key === "ficonter-density") {
        applyPreferences(currentAppearance, currentDensity);
      }
    };

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ appearance?: string; density?: string }>).detail;
      currentAppearance = normalizeAppearance(detail?.appearance ?? currentAppearance);
      currentDensity = normalizeDensity(detail?.density ?? currentDensity);
      applyPreferences(currentAppearance, currentDensity);
    };

    media.addEventListener("change", handleMediaChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("ficonter:preferences-updated", handlePreferencesUpdated);

    return () => {
      media.removeEventListener("change", handleMediaChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("ficonter:preferences-updated", handlePreferencesUpdated);
    };
  }, [appearance, density]);

  return null;
}
