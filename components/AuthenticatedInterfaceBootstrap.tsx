import { InterfacePreferencesBootstrap } from "@/components/InterfacePreferencesBootstrap";
import {
  DARK_APPEARANCE_VALUES,
  FIXED_INTERFACE_PROFILE_VERSION,
  normalizeAppearance,
  normalizeBackgroundMotion,
  normalizeSurfaceOpacity,
  normalizeWallpaperScene,
} from "@/lib/interfaceThemes";
import styles from "./AuthenticatedInterfaceBootstrap.module.css";

type DensityPreference = "comfortable" | "compact";

type Props = {
  appearance?: string | null;
  density?: string | null;
  backgroundMotion?: string | null;
  wallpaperScene?: string | null;
  surfaceOpacity?: number | string | null;
  wallpaperAccessEnabled?: boolean;
};

function normalizeDensity(value: string | null | undefined): DensityPreference {
  return value === "compact" ? "compact" : "comfortable";
}

export function AuthenticatedInterfaceBootstrap({
  appearance,
  density,
  backgroundMotion,
  wallpaperScene,
  surfaceOpacity,
  wallpaperAccessEnabled = false,
}: Props) {
  const normalizedAppearance = normalizeAppearance(appearance);
  const normalizedDensity = normalizeDensity(density);
  const normalizedBackgroundMotion = normalizeBackgroundMotion(backgroundMotion);
  const normalizedWallpaperScene = wallpaperAccessEnabled
    ? normalizeWallpaperScene(wallpaperScene)
    : "coastal-island";
  const normalizedSurfaceOpacity = normalizeSurfaceOpacity(surfaceOpacity);

  const prepaintScript = `
(function () {
  try {
    var root = document.documentElement;
    var appearance = ${JSON.stringify(normalizedAppearance)};
    var density = ${JSON.stringify(normalizedDensity)};
    var backgroundMotion = ${JSON.stringify(normalizedBackgroundMotion)};
    var wallpaperScene = ${JSON.stringify(normalizedWallpaperScene)};
    var surfaceOpacity = ${JSON.stringify(normalizedSurfaceOpacity)};
    var darkThemes = ${JSON.stringify(DARK_APPEARANCE_VALUES)};
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolvedTheme = appearance === "system"
      ? (prefersDark ? "dark" : "light")
      : (darkThemes.indexOf(appearance) >= 0 ? "dark" : "light");

    root.dataset.theme = appearance;
    root.dataset.resolvedTheme = resolvedTheme;
    root.dataset.density = density;
    root.dataset.backgroundMotion = backgroundMotion;
    root.dataset.wallpaperScene = wallpaperScene;
    root.dataset.surfaceOpacity = String(surfaceOpacity);
    root.style.setProperty("--ficonter-surface-opacity", String(surfaceOpacity) + "%");
    root.style.colorScheme = resolvedTheme;

    delete root.dataset.sidebarAtmosphereMode;
    delete root.dataset.sidebarAtmosphereStyle;
    delete root.dataset.sidebarAtmosphereMotion;

    localStorage.setItem("ficonter-appearance", appearance);
    localStorage.setItem("ficonter-density", density);
    localStorage.setItem("ficonter-background-motion", backgroundMotion);
    localStorage.setItem("ficonter-wallpaper-scene", wallpaperScene);
    localStorage.setItem("ficonter-surface-opacity", String(surfaceOpacity));
    localStorage.setItem(
      "ficonter-interface-profile-version",
      ${JSON.stringify(FIXED_INTERFACE_PROFILE_VERSION)}
    );
    localStorage.removeItem("ficonter-layout");
    localStorage.removeItem("ficonter-sidebar-atmosphere-mode");
    localStorage.removeItem("ficonter-sidebar-atmosphere-style");
    localStorage.removeItem("ficonter-sidebar-atmosphere-motion");
  } catch (_) {}
})();`;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: prepaintScript }} />
      <span className={styles.mount} aria-hidden="true" />
      <InterfacePreferencesBootstrap
        appearance={normalizedAppearance}
        density={normalizedDensity}
        backgroundMotion={normalizedBackgroundMotion}
        wallpaperScene={normalizedWallpaperScene}
        surfaceOpacity={normalizedSurfaceOpacity}
        wallpaperAccessEnabled={wallpaperAccessEnabled}
      />
    </>
  );
}
