"use client";

import { useLayoutEffect } from "react";
import {
  FIXED_INTERFACE_PROFILE_VERSION,
  normalizeAppearance,
  normalizeBackgroundMotion,
  normalizeWallpaperScene,
  resolveAppearance,
  type AppearancePreference,
  type BackgroundMotionPreference,
  type WallpaperScenePreference,
} from "@/lib/interfaceThemes";

type DensityPreference = "comfortable" | "compact";

type Props = {
  appearance?: string | null;
  density?: string | null;
  backgroundMotion?: string | null;
  wallpaperScene?: string | null;
};

function normalizeDensity(value: string | null | undefined): DensityPreference {
  return value === "compact" ? "compact" : "comfortable";
}

function removeLegacySidebarAtmosphere() {
  const root = document.documentElement;
  delete root.dataset.sidebarAtmosphereMode;
  delete root.dataset.sidebarAtmosphereStyle;
  delete root.dataset.sidebarAtmosphereMotion;

  try {
    localStorage.removeItem("ficonter-sidebar-atmosphere-mode");
    localStorage.removeItem("ficonter-sidebar-atmosphere-style");
    localStorage.removeItem("ficonter-sidebar-atmosphere-motion");
  } catch {
    // Strict privacy modes can block storage. The obsolete DOM state is still removed.
  }
}

function applyPreferences(
  appearance: AppearancePreference,
  density: DensityPreference,
  backgroundMotion: BackgroundMotionPreference,
  wallpaperScene: WallpaperScenePreference,
) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = resolveAppearance(appearance, prefersDark);

  root.dataset.theme = appearance;
  root.dataset.resolvedTheme = resolvedTheme;
  root.dataset.density = density;
  root.dataset.backgroundMotion = backgroundMotion;
  root.dataset.wallpaperScene = wallpaperScene;
  root.style.colorScheme = resolvedTheme;
  removeLegacySidebarAtmosphere();

  try {
    localStorage.setItem("ficonter-appearance", appearance);
    localStorage.setItem("ficonter-density", density);
    localStorage.removeItem("ficonter-layout");
    localStorage.setItem("ficonter-background-motion", backgroundMotion);
    localStorage.setItem("ficonter-wallpaper-scene", wallpaperScene);
    localStorage.setItem(
      "ficonter-interface-profile-version",
      FIXED_INTERFACE_PROFILE_VERSION,
    );
  } catch {
    // Strict privacy modes can block storage. The active DOM state still applies.
  }
}

export function InterfacePreferencesBootstrap({
  appearance,
  density,
  backgroundMotion,
  wallpaperScene,
}: Props) {
  useLayoutEffect(() => {
    function readStorage(key: string) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }

    const requiresProfileMigration =
      readStorage("ficonter-interface-profile-version") !==
      FIXED_INTERFACE_PROFILE_VERSION;
    let currentAppearance = normalizeAppearance(
      readStorage("ficonter-appearance") ?? appearance,
    );
    let currentDensity = normalizeDensity(
      readStorage("ficonter-density") ?? density,
    );
    let currentBackgroundMotion = normalizeBackgroundMotion(
      readStorage("ficonter-background-motion") ?? backgroundMotion,
    );
    let currentWallpaperScene = normalizeWallpaperScene(
      readStorage("ficonter-wallpaper-scene") ?? wallpaperScene,
    );

    if (requiresProfileMigration) {
      currentAppearance = "light";
      currentDensity = "comfortable";
      currentBackgroundMotion = "static";
      currentWallpaperScene = "coastal-island";
    }

    const applyCurrent = () =>
      applyPreferences(
        currentAppearance,
        currentDensity,
        currentBackgroundMotion,
        currentWallpaperScene,
      );

    applyCurrent();

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleMediaChange = () => {
      if (currentAppearance === "system") applyCurrent();
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
      if (event.key === "ficonter-wallpaper-scene") {
        currentWallpaperScene = normalizeWallpaperScene(event.newValue);
      }

      if (
        event.key === "ficonter-appearance" ||
        event.key === "ficonter-density" ||
        event.key === "ficonter-background-motion" ||
        event.key === "ficonter-wallpaper-scene"
      ) {
        applyCurrent();
      }
    };

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          appearance?: string;
          density?: string;
          backgroundMotion?: string;
          wallpaperScene?: string;
        }>
      ).detail;

      currentAppearance = normalizeAppearance(
        detail?.appearance ?? currentAppearance,
      );
      currentDensity = normalizeDensity(detail?.density ?? currentDensity);
      currentBackgroundMotion = normalizeBackgroundMotion(
        detail?.backgroundMotion ?? currentBackgroundMotion,
      );
      currentWallpaperScene = normalizeWallpaperScene(
        detail?.wallpaperScene ?? currentWallpaperScene,
      );
      applyCurrent();
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
  }, [appearance, backgroundMotion, density, wallpaperScene]);

  return null;
}
