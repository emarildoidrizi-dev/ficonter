"use client";

import { useLayoutEffect } from "react";
import {
  normalizeAppearance,
  normalizeBackgroundMotion,
  normalizeSidebarAtmosphereMode,
  normalizeSidebarAtmosphereMotion,
  normalizeSidebarAtmosphereStyle,
  normalizeWallpaperScene,
  resolveAppearance,
  resolveSidebarAtmosphereStyle,
  type AppearancePreference,
  type BackgroundMotionPreference,
  type SidebarAtmosphereMode,
  type SidebarAtmosphereMotion,
  type SidebarAtmosphereStyle,
  type WallpaperScenePreference,
} from "@/lib/interfaceThemes";
type DensityPreference = "comfortable" | "compact";

type Props = {
  appearance?: string | null;
  density?: string | null;
  backgroundMotion?: string | null;
  wallpaperScene?: string | null;
  sidebarAtmosphereMode?: string | null;
  sidebarAtmosphereStyle?: string | null;
  sidebarAtmosphereMotion?: string | null;
};

function normalizeDensity(value: string | null | undefined): DensityPreference {
  return value === "compact" ? "compact" : "comfortable";
}

function applyPreferences(
  appearance: AppearancePreference,
  density: DensityPreference,
  backgroundMotion: BackgroundMotionPreference,
  wallpaperScene: WallpaperScenePreference,
  sidebarAtmosphereMode: SidebarAtmosphereMode,
  sidebarAtmosphereStyle: SidebarAtmosphereStyle,
  sidebarAtmosphereMotion: SidebarAtmosphereMotion,
) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = resolveAppearance(appearance, prefersDark);
  const resolvedSidebarAtmosphere = resolveSidebarAtmosphereStyle(
    appearance,
    resolvedTheme,
    wallpaperScene,
    sidebarAtmosphereMode,
    sidebarAtmosphereStyle,
  );

  root.dataset.theme = appearance;
  root.dataset.resolvedTheme = resolvedTheme;
  root.dataset.density = density;
  root.dataset.backgroundMotion = backgroundMotion;
  root.dataset.wallpaperScene = wallpaperScene;
  root.dataset.sidebarAtmosphereMode = sidebarAtmosphereMode;
  root.dataset.sidebarAtmosphereStyle = resolvedSidebarAtmosphere;
  root.dataset.sidebarAtmosphereMotion = sidebarAtmosphereMotion;
  root.style.colorScheme = resolvedTheme;

  try {
    localStorage.setItem("ficonter-appearance", appearance);
    localStorage.setItem("ficonter-density", density);
    localStorage.removeItem("ficonter-layout");
    localStorage.setItem("ficonter-background-motion", backgroundMotion);
    localStorage.setItem("ficonter-wallpaper-scene", wallpaperScene);
    localStorage.setItem(
      "ficonter-sidebar-atmosphere-mode",
      sidebarAtmosphereMode,
    );
    localStorage.setItem(
      "ficonter-sidebar-atmosphere-style",
      sidebarAtmosphereStyle,
    );
    localStorage.setItem(
      "ficonter-sidebar-atmosphere-motion",
      sidebarAtmosphereMotion,
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
  sidebarAtmosphereMode,
  sidebarAtmosphereStyle,
  sidebarAtmosphereMotion,
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
    let currentBackgroundMotion = normalizeBackgroundMotion(
      readStorage("ficonter-background-motion") ?? backgroundMotion,
    );
    let currentWallpaperScene = normalizeWallpaperScene(
      readStorage("ficonter-wallpaper-scene") ?? wallpaperScene,
    );
    let currentSidebarAtmosphereMode = normalizeSidebarAtmosphereMode(
      readStorage("ficonter-sidebar-atmosphere-mode") ?? sidebarAtmosphereMode,
    );
    let currentSidebarAtmosphereStyle = normalizeSidebarAtmosphereStyle(
      readStorage("ficonter-sidebar-atmosphere-style") ?? sidebarAtmosphereStyle,
    );
    let currentSidebarAtmosphereMotion = normalizeSidebarAtmosphereMotion(
      readStorage("ficonter-sidebar-atmosphere-motion") ??
        sidebarAtmosphereMotion,
    );

    const applyCurrent = () =>
      applyPreferences(
        currentAppearance,
        currentDensity,
        currentBackgroundMotion,
        currentWallpaperScene,
        currentSidebarAtmosphereMode,
        currentSidebarAtmosphereStyle,
        currentSidebarAtmosphereMotion,
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
      if (event.key === "ficonter-sidebar-atmosphere-mode") {
        currentSidebarAtmosphereMode = normalizeSidebarAtmosphereMode(
          event.newValue,
        );
      }
      if (event.key === "ficonter-sidebar-atmosphere-style") {
        currentSidebarAtmosphereStyle = normalizeSidebarAtmosphereStyle(
          event.newValue,
        );
      }
      if (event.key === "ficonter-sidebar-atmosphere-motion") {
        currentSidebarAtmosphereMotion = normalizeSidebarAtmosphereMotion(
          event.newValue,
        );
      }

      if (
        event.key === "ficonter-appearance" ||
        event.key === "ficonter-density" ||
        event.key === "ficonter-background-motion" ||
        event.key === "ficonter-wallpaper-scene" ||
        event.key === "ficonter-sidebar-atmosphere-mode" ||
        event.key === "ficonter-sidebar-atmosphere-style" ||
        event.key === "ficonter-sidebar-atmosphere-motion"
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
          sidebarAtmosphereMode?: string;
          sidebarAtmosphereStyle?: string;
          sidebarAtmosphereMotion?: string;
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
      currentSidebarAtmosphereMode = normalizeSidebarAtmosphereMode(
        detail?.sidebarAtmosphereMode ?? currentSidebarAtmosphereMode,
      );
      currentSidebarAtmosphereStyle = normalizeSidebarAtmosphereStyle(
        detail?.sidebarAtmosphereStyle ?? currentSidebarAtmosphereStyle,
      );
      currentSidebarAtmosphereMotion = normalizeSidebarAtmosphereMotion(
        detail?.sidebarAtmosphereMotion ?? currentSidebarAtmosphereMotion,
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
  }, [
    appearance,
    backgroundMotion,
    density,
    sidebarAtmosphereMode,
    sidebarAtmosphereMotion,
    sidebarAtmosphereStyle,
    wallpaperScene,
  ]);

  return null;
}
