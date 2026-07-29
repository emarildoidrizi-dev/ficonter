"use client";

import { useLayoutEffect } from "react";
import {
  normalizeAppearance,
  normalizeBackgroundMotion,
  normalizeWallpaperScene,
  resolveAppearance,
  type AppearancePreference,
  type BackgroundMotionPreference,
  type WallpaperScenePreference,
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
  backgroundMotion?: string | null;
  wallpaperScene?: string | null;
};

function normalizeDensity(value: string | null | undefined): DensityPreference {
  return value === "compact" ? "compact" : "comfortable";
}

function applyPreferences(
  appearance: AppearancePreference,
  density: DensityPreference,
  layout: InterfaceLayoutPreference,
  backgroundMotion: BackgroundMotionPreference,
  wallpaperScene: WallpaperScenePreference,
) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = resolveAppearance(appearance, prefersDark);

  root.dataset.theme = appearance;
  root.dataset.resolvedTheme = resolvedTheme;
  root.dataset.density = density;
  root.dataset.layout = layout;
  root.dataset.backgroundMotion = backgroundMotion;
  root.dataset.wallpaperScene = wallpaperScene;
  root.style.colorScheme = resolvedTheme;

  try {
    localStorage.setItem("ficonter-appearance", appearance);
    localStorage.setItem("ficonter-density", density);
    localStorage.setItem("ficonter-layout", layout);
    localStorage.setItem("ficonter-background-motion", backgroundMotion);
    localStorage.setItem("ficonter-wallpaper-scene", wallpaperScene);
  } catch {
    // Strict privacy modes can block storage. The active DOM state still applies.
  }
}

export function InterfacePreferencesBootstrap({
  appearance,
  density,
  layout,
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

    let currentAppearance = normalizeAppearance(
      readStorage("ficonter-appearance") ?? appearance,
    );
    let currentDensity = normalizeDensity(
      readStorage("ficonter-density") ?? density,
    );
    let currentLayout = normalizeInterfaceLayout(
      readStorage("ficonter-layout") ?? layout,
    );
    let currentBackgroundMotion = normalizeBackgroundMotion(
      readStorage("ficonter-background-motion") ?? backgroundMotion,
    );
    let currentWallpaperScene = normalizeWallpaperScene(
      readStorage("ficonter-wallpaper-scene") ?? wallpaperScene,
    );

    const applyCurrent = () =>
      applyPreferences(
        currentAppearance,
        currentDensity,
        currentLayout,
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
      if (event.key === "ficonter-layout") {
        currentLayout = normalizeInterfaceLayout(event.newValue);
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
        event.key === "ficonter-layout" ||
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
          layout?: string;
          backgroundMotion?: string;
          wallpaperScene?: string;
        }>
      ).detail;

      currentAppearance = normalizeAppearance(
        detail?.appearance ?? currentAppearance,
      );
      currentDensity = normalizeDensity(detail?.density ?? currentDensity);
      currentLayout = normalizeInterfaceLayout(
        detail?.layout ?? currentLayout,
      );
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
  }, [appearance, backgroundMotion, density, layout, wallpaperScene]);

  return null;
}
