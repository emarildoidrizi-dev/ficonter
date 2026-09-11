"use client";

import { useLayoutEffect } from "react";
import {
  FIXED_INTERFACE_PROFILE_VERSION,
  normalizeAppearance,
  normalizeBackgroundMotion,
  normalizeSurfaceOpacity,
  normalizeWallpaperScene,
  resolveAppearance,
} from "@/lib/interfaceThemes";

type Props = {
  appearance?: string | null;
  density?: string | null;
  backgroundMotion?: string | null;
  wallpaperScene?: string | null;
  surfaceOpacity?: number | string | null;
};

export function AuthenticatedThemeSync(props: Props) {
  useLayoutEffect(() => {
    const appearance = normalizeAppearance(props.appearance);
    const density = props.density === "compact" ? "compact" : "comfortable";
    const backgroundMotion = normalizeBackgroundMotion(props.backgroundMotion);
    const wallpaperScene = normalizeWallpaperScene(props.wallpaperScene);
    const surfaceOpacity = normalizeSurfaceOpacity(props.surfaceOpacity);
    const resolved = resolveAppearance(
      appearance,
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    const root = document.documentElement;

    root.dataset.theme = appearance;
    root.dataset.resolvedTheme = resolved;
    root.dataset.density = density;
    root.dataset.backgroundMotion = backgroundMotion;
    root.dataset.wallpaperScene = wallpaperScene;
    root.dataset.surfaceOpacity = String(surfaceOpacity);
    root.style.setProperty("--ficonter-surface-opacity", `${surfaceOpacity}%`);
    root.style.colorScheme = resolved;

    try {
      localStorage.setItem("ficonter-appearance", appearance);
      localStorage.setItem("ficonter-density", density);
      localStorage.setItem("ficonter-background-motion", backgroundMotion);
      localStorage.setItem("ficonter-wallpaper-scene", wallpaperScene);
      localStorage.setItem("ficonter-surface-opacity", String(surfaceOpacity));
      localStorage.setItem(
        "ficonter-interface-profile-version",
        FIXED_INTERFACE_PROFILE_VERSION,
      );
    } catch {}

    const shell = document.querySelector<HTMLElement>(
      ".app-shell[data-auth-theme-pending='true']",
    );
    if (shell) {
      shell.dataset.authThemePending = "false";
      shell.style.visibility = "visible";
    }
  }, [
    props.appearance,
    props.backgroundMotion,
    props.density,
    props.surfaceOpacity,
    props.wallpaperScene,
  ]);

  return null;
}
