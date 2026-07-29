"use client";

import { useLayoutEffect } from "react";
import {
  normalizeAppearance,
  normalizeBackgroundMotion,
  resolveAppearance,
  type AppearancePreference,
  type BackgroundMotionPreference,
} from "@/lib/interfaceThemes";

type DensityPreference = "comfortable" | "compact";

type Props = {
  appearance?: string | null;
  density?: string | null;
  backgroundMotion?: string | null;
};

function normalizeDensity(value: string | null | undefined): DensityPreference {
  return value === "compact" ? "compact" : "comfortable";
}

function applyPreferences(
  appearance: AppearancePreference,
  density: DensityPreference,
  backgroundMotion: BackgroundMotionPreference,
) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = resolveAppearance(appearance, prefersDark);

  root.dataset.theme = appearance;
  root.dataset.resolvedTheme = resolvedTheme;
  root.dataset.density = density;
  root.dataset.backgroundMotion = backgroundMotion;
  root.style.colorScheme = resolvedTheme;

  try {
    localStorage.setItem("ficonter-appearance", appearance);
    localStorage.setItem("ficonter-density", density);
    localStorage.setItem("ficonter-background-motion", backgroundMotion);
  } catch {
    // Browsers can block storage in strict privacy modes. The live DOM state still applies.
  }
}

export function InterfacePreferencesBootstrap({
  appearance,
  density,
  backgroundMotion,
}: Props) {
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
    const storedBackgroundMotion = (() => {
      try {
        return localStorage.getItem("ficonter-background-motion");
      } catch {
        return null;
      }
    })();

    let currentAppearance = normalizeAppearance(storedAppearance ?? appearance);
    let currentDensity = normalizeDensity(storedDensity ?? density);
    let currentBackgroundMotion = normalizeBackgroundMotion(
      storedBackgroundMotion ?? backgroundMotion,
    );

    applyPreferences(
      currentAppearance,
      currentDensity,
      currentBackgroundMotion,
    );

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleMediaChange = () => {
      if (currentAppearance === "system") {
        applyPreferences(
          currentAppearance,
          currentDensity,
          currentBackgroundMotion,
        );
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "ficonter-appearance") {
        currentAppearance = normalizeAppearance(event.newValue);
      }
      if (event.key === "ficonter-density") {
        currentDensity = normalizeDensity(event.newValue);
      }
      if (event.key === "ficonter-background-motion") {
        currentBackgroundMotion = normalizeBackgroundMotion(event.newValue);
      }
      if (
        event.key === "ficonter-appearance" ||
        event.key === "ficonter-density" ||
        event.key === "ficonter-background-motion"
      ) {
        applyPreferences(
          currentAppearance,
          currentDensity,
          currentBackgroundMotion,
        );
      }
    };

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          appearance?: string;
          density?: string;
          backgroundMotion?: string;
        }>
      ).detail;
      currentAppearance = normalizeAppearance(
        detail?.appearance ?? currentAppearance,
      );
      currentDensity = normalizeDensity(detail?.density ?? currentDensity);
      currentBackgroundMotion = normalizeBackgroundMotion(
        detail?.backgroundMotion ?? currentBackgroundMotion,
      );
      applyPreferences(
        currentAppearance,
        currentDensity,
        currentBackgroundMotion,
      );
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
  }, [appearance, backgroundMotion, density]);

  return null;
}
